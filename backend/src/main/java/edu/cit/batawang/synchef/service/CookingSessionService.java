package edu.cit.batawang.synchef.service;

import edu.cit.batawang.synchef.dto.CookingDtos.CookingSessionView;
import edu.cit.batawang.synchef.dto.CookingDtos.ParticipantView;
import edu.cit.batawang.synchef.dto.CookingDtos.StartSessionRequest;
import edu.cit.batawang.synchef.dto.CookingDtos.TimerView;
import edu.cit.batawang.synchef.dto.ScaledRecipeDTO;
import edu.cit.batawang.synchef.dto.ScaledStepDTO;
import edu.cit.batawang.synchef.exception.ApiException;
import edu.cit.batawang.synchef.model.CookingParticipant;
import edu.cit.batawang.synchef.model.CookingSession;
import edu.cit.batawang.synchef.model.CookingTimer;
import edu.cit.batawang.synchef.model.Recipe;
import edu.cit.batawang.synchef.model.User;
import edu.cit.batawang.synchef.repository.CookingSessionRepository;
import edu.cit.batawang.synchef.repository.RecipeRepository;
import edu.cit.batawang.synchef.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.function.BiFunction;

/**
 * Real-time cooking execution. The server owns the session state (current step, completed steps,
 * timers, participants); clients send commands over REST and receive the new state on
 * {@code /topic/cooking-sessions/{id}}. Concurrent commands from several participants are
 * serialized with optimistic locking and retried.
 */
@Service
@Slf4j
public class CookingSessionService {

    public static final int MAX_PARTICIPANTS = 12;
    private static final int MAX_RETRIES = 3;
    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final CookingSessionRepository sessionRepository;
    private final RecipeRepository recipeRepository;
    private final UserRepository userRepository;
    private final RecipeScalingService scalingService;
    private final RealtimePublisher realtime;
    private final CookingPresenceTracker presence;
    private final TransactionTemplate tx;
    private final TransactionTemplate readTx;

    public CookingSessionService(CookingSessionRepository sessionRepository,
                                 RecipeRepository recipeRepository,
                                 UserRepository userRepository,
                                 RecipeScalingService scalingService,
                                 RealtimePublisher realtime,
                                 CookingPresenceTracker presence,
                                 PlatformTransactionManager transactionManager) {
        this.sessionRepository = sessionRepository;
        this.recipeRepository = recipeRepository;
        this.userRepository = userRepository;
        this.scalingService = scalingService;
        this.realtime = realtime;
        this.presence = presence;
        this.tx = new TransactionTemplate(transactionManager);
        this.readTx = new TransactionTemplate(transactionManager);
        this.readTx.setReadOnly(true);
    }

    // ── queries ─────────────────────────────────────────────────────────────

    public CookingSessionView get(Long sessionId, Long userId) {
        return readTx.execute(status -> {
            CookingSession session = requireAccessible(sessionId, userId);
            return view(session, true, null);
        });
    }

    public List<CookingSessionView> activeFor(Long userId) {
        return readTx.execute(status -> sessionRepository.findForUserByStatus(userId, CookingSession.STATUS_ACTIVE)
                .stream().map(s -> view(s, false, null)).toList());
    }

    public List<CookingSessionView> historyFor(Long userId) {
        return readTx.execute(status -> sessionRepository.findForUserByStatus(userId, CookingSession.STATUS_COMPLETED)
                .stream().limit(30).map(s -> view(s, false, null)).toList());
    }

    public boolean canAccess(Long sessionId, Long userId) {
        Boolean allowed = readTx.execute(status -> sessionRepository.findById(sessionId)
                .map(s -> s.getHostUserId().equals(userId) || s.hasParticipant(userId))
                .orElse(false));
        return Boolean.TRUE.equals(allowed);
    }

    // ── lifecycle ───────────────────────────────────────────────────────────

    /** Starts a session, or resumes the user's active session for the same recipe. */
    public CookingSessionView start(Long userId, StartSessionRequest request) {
        return tx.execute(status -> {
            User user = requireUser(userId);
            Recipe recipe = recipeRepository.findById(request.recipeId())
                    .orElseThrow(() -> ApiException.notFound("Recipe not found"));
            if (recipe.getSteps().isEmpty()) {
                throw ApiException.badRequest("This recipe has no steps to cook");
            }
            Optional<CookingSession> existing = sessionRepository.findActiveByHostAndRecipe(userId, recipe.getId())
                    .stream().findFirst();
            Instant now = Instant.now();
            CookingSession session;
            if (existing.isPresent()) {
                session = existing.get();
                if (!session.getServings().equals(request.servings()) && session.getTimers().isEmpty()) {
                    session.setServings(request.servings());
                }
                session.setUpdatedAt(now);
            } else {
                session = new CookingSession();
                session.setRecipe(recipe);
                session.setHostUserId(userId);
                session.setServings(request.servings());
                session.setStartedAt(now);
                session.setUpdatedAt(now);
                session.getParticipants().add(new CookingParticipant(userId, user.displayName(), now));
            }
            CookingSession saved = sessionRepository.save(session);
            return view(saved, true, null);
        });
    }

    public CookingSessionView share(Long sessionId, Long userId) {
        return mutate(sessionId, userId, (session, actor) -> {
            requireActive(session);
            if (session.getJoinCode() == null) {
                session.setJoinCode(uniqueCode());
            }
            return actor + " opened the session to friends";
        });
    }

    public CookingSessionView join(String code, Long userId) {
        String normalized = code.trim().toUpperCase();
        Long sessionId = readTx.execute(status -> sessionRepository.findByJoinCode(normalized)
                .filter(CookingSession::isActive)
                .map(CookingSession::getId)
                .orElseThrow(() -> ApiException.notFound("No active cooking session uses this code")));
        User user = requireUser(userId);
        CookingSessionView result = retrying(() -> tx.execute(status -> {
            CookingSession session = sessionRepository.findById(sessionId)
                    .orElseThrow(() -> ApiException.notFound("Cooking session not found"));
            requireActive(session);
            if (!session.hasParticipant(userId)) {
                if (session.getParticipants().size() >= MAX_PARTICIPANTS) {
                    throw ApiException.conflict("This session is full");
                }
                session.getParticipants().add(new CookingParticipant(userId, user.displayName(), Instant.now()));
                session.setUpdatedAt(Instant.now());
            }
            CookingSession saved = sessionRepository.saveAndFlush(session);
            CookingSessionView broadcast = view(saved, false, user.displayName() + " joined the kitchen");
            realtime.toTopic(topic(sessionId), broadcast);
            return view(saved, true, null);
        }));
        log.info("User {} joined cooking session {}", userId, sessionId);
        return result;
    }

    public CookingSessionView leave(Long sessionId, Long userId) {
        return mutate(sessionId, userId, (session, actor) -> {
            session.getParticipants().removeIf(p -> p.getUserId().equals(userId));
            if (session.getHostUserId().equals(userId)) {
                Optional<CookingParticipant> next = session.getParticipants().stream()
                        .min(Comparator.comparing(CookingParticipant::getJoinedAt));
                if (next.isPresent()) {
                    session.setHostUserId(next.get().getUserId());
                    return actor + " left — " + next.get().getDisplayName() + " is now the host";
                }
                session.setStatus(CookingSession.STATUS_ABANDONED);
                session.setJoinCode(null);
            }
            return actor + " left the kitchen";
        });
    }

    public CookingSessionView complete(Long sessionId, Long userId) {
        return mutate(sessionId, userId, (session, actor) -> {
            requireActive(session);
            session.setStatus(CookingSession.STATUS_COMPLETED);
            session.setCompletedAt(Instant.now());
            session.setJoinCode(null);
            for (int i = 0; i < totalSteps(session); i++) session.getCompletedSteps().add(i);
            session.getTimers().clear();
            return actor + " finished the dish 🎉";
        });
    }

    public CookingSessionView abandon(Long sessionId, Long userId) {
        return mutate(sessionId, userId, (session, actor) -> {
            requireActive(session);
            if (!session.getHostUserId().equals(userId)) {
                throw ApiException.forbidden("Only the host can end the session for everyone");
            }
            session.setStatus(CookingSession.STATUS_ABANDONED);
            session.setJoinCode(null);
            session.getTimers().clear();
            return actor + " ended the session";
        });
    }

    // ── steps ───────────────────────────────────────────────────────────────

    public CookingSessionView goToStep(Long sessionId, Long userId, int index) {
        return mutate(sessionId, userId, (session, actor) -> {
            requireActive(session);
            requireStep(session, index);
            session.setCurrentStepIndex(index);
            return actor + " moved to step " + (index + 1);
        });
    }

    public CookingSessionView setStepCompleted(Long sessionId, Long userId, int index, boolean completed) {
        return mutate(sessionId, userId, (session, actor) -> {
            requireActive(session);
            requireStep(session, index);
            if (completed) {
                session.getCompletedSteps().add(index);
                return actor + " completed step " + (index + 1);
            }
            session.getCompletedSteps().remove(index);
            return actor + " reopened step " + (index + 1);
        });
    }

    // ── timers ──────────────────────────────────────────────────────────────

    public CookingSessionView startTimer(Long sessionId, Long userId, int stepIndex) {
        return mutate(sessionId, userId, (session, actor) -> {
            requireActive(session);
            ScaledStepDTO step = requireStep(session, stepIndex);
            if (step.getScaledTimerSeconds() == null || step.getScaledTimerSeconds() <= 0) {
                throw ApiException.badRequest("This step has no timer");
            }
            Instant now = Instant.now();
            CookingTimer timer = findTimer(session, stepIndex).orElse(null);
            if (timer != null && CookingTimer.PAUSED.equals(timer.getState())) {
                timer.setState(CookingTimer.RUNNING);
                timer.setEndsAt(now.plusSeconds(timer.getRemainingSeconds()));
                timer.setRemainingSeconds(null);
                return actor + " resumed " + label(timer);
            }
            if (timer != null && CookingTimer.RUNNING.equals(timer.getState()) && timer.getEndsAt().isAfter(now)) {
                return null; // already running — idempotent
            }
            session.getTimers().removeIf(t -> t.getStepIndex().equals(stepIndex));
            CookingTimer fresh = new CookingTimer(stepIndex,
                    step.getTimerLabel() != null ? step.getTimerLabel() : "Step " + (stepIndex + 1),
                    step.getScaledTimerSeconds(), CookingTimer.RUNNING,
                    now.plusSeconds(step.getScaledTimerSeconds()), null);
            session.getTimers().add(fresh);
            return actor + " started " + label(fresh);
        });
    }

    public CookingSessionView pauseTimer(Long sessionId, Long userId, int stepIndex) {
        return mutate(sessionId, userId, (session, actor) -> {
            requireActive(session);
            CookingTimer timer = findTimer(session, stepIndex)
                    .orElseThrow(() -> ApiException.notFound("No timer is running for this step"));
            if (!CookingTimer.RUNNING.equals(timer.getState())) {
                return null;
            }
            long remaining = Math.max(0, Duration.between(Instant.now(), timer.getEndsAt()).getSeconds());
            timer.setState(remaining == 0 ? CookingTimer.DONE : CookingTimer.PAUSED);
            timer.setRemainingSeconds((int) remaining);
            timer.setEndsAt(null);
            return actor + " paused " + label(timer);
        });
    }

    public CookingSessionView resetTimer(Long sessionId, Long userId, int stepIndex) {
        return mutate(sessionId, userId, (session, actor) -> {
            requireActive(session);
            boolean removed = session.getTimers().removeIf(t -> t.getStepIndex().equals(stepIndex));
            return removed ? actor + " reset the timer for step " + (stepIndex + 1) : null;
        });
    }

    @EventListener
    public void onPresenceChanged(CookingPresenceTracker.PresenceChanged event) {
        CookingSessionView view = readTx.execute(status -> sessionRepository.findById(event.cookingSessionId())
                .filter(CookingSession::isActive)
                .map(s -> view(s, false, null))
                .orElse(null));
        if (view != null) {
            realtime.toTopic(topic(event.cookingSessionId()), view);
        }
    }

    // ── internals ───────────────────────────────────────────────────────────

    /**
     * Runs a command in its own transaction with optimistic-lock retries, persists it, and
     * broadcasts the new state with a human-readable description of what happened.
     */
    private CookingSessionView mutate(Long sessionId, Long userId,
                                      BiFunction<CookingSession, String, String> command) {
        String actor = requireUser(userId).displayName();
        return retrying(() -> tx.execute(status -> {
            CookingSession session = sessionRepository.findById(sessionId)
                    .orElseThrow(() -> ApiException.notFound("Cooking session not found"));
            if (!session.getHostUserId().equals(userId) && !session.hasParticipant(userId)) {
                throw ApiException.forbidden("You are not part of this cooking session");
            }
            String description = command.apply(session, actor);
            if (description == null) {
                return view(session, true, null);
            }
            session.setUpdatedAt(Instant.now());
            CookingSession saved = sessionRepository.saveAndFlush(session);
            realtime.toTopic(topic(sessionId), view(saved, false, description));
            return view(saved, true, description);
        }));
    }

    private <T> T retrying(java.util.function.Supplier<T> action) {
        OptimisticLockingFailureException last = null;
        for (int attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                return action.get();
            } catch (OptimisticLockingFailureException e) {
                last = e;
            }
        }
        throw last;
    }

    private CookingSessionView view(CookingSession s, boolean includeRecipe, String lastAction) {
        Instant now = Instant.now();
        Set<Long> online = presence.onlineUsers(s.getId());
        List<TimerView> timers = s.getTimers().stream()
                .sorted(Comparator.comparing(CookingTimer::getStepIndex))
                .map(t -> {
                    boolean finished = CookingTimer.RUNNING.equals(t.getState()) && !t.getEndsAt().isAfter(now);
                    return new TimerView(t.getStepIndex(), t.getLabel(), t.getDurationSeconds(),
                            finished ? CookingTimer.DONE : t.getState(),
                            t.getEndsAt(), finished ? Integer.valueOf(0) : t.getRemainingSeconds());
                })
                .toList();
        List<ParticipantView> participants = s.getParticipants().stream()
                .sorted(Comparator.comparing(CookingParticipant::getJoinedAt))
                .map(p -> new ParticipantView(p.getUserId(), p.getDisplayName(), p.getJoinedAt(),
                        p.getUserId().equals(s.getHostUserId()), online.contains(p.getUserId())))
                .toList();
        ScaledRecipeDTO recipe = includeRecipe ? scalingService.scale(s.getRecipe(), s.getServings()) : null;
        return new CookingSessionView(
                s.getId(), s.getRecipe().getId(), s.getRecipe().getName(), s.getRecipe().getImageUrl(),
                s.getServings(), s.getCurrentStepIndex(), totalSteps(s),
                s.getCompletedSteps().stream().sorted().toList(), timers, participants, s.getStatus(),
                s.getJoinCode(), s.getHostUserId(), s.getStartedAt(), s.getUpdatedAt(), s.getCompletedAt(),
                s.getVersion(), now, lastAction, recipe);
    }

    private CookingSession requireAccessible(Long sessionId, Long userId) {
        CookingSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> ApiException.notFound("Cooking session not found"));
        if (!session.getHostUserId().equals(userId) && !session.hasParticipant(userId)) {
            throw ApiException.forbidden("You are not part of this cooking session");
        }
        return session;
    }

    private ScaledStepDTO requireStep(CookingSession session, int index) {
        List<ScaledStepDTO> steps = scalingService.scale(session.getRecipe(), session.getServings()).getScaledSteps();
        if (index < 0 || index >= steps.size()) {
            throw ApiException.badRequest("Step does not exist");
        }
        return steps.get(index);
    }

    private void requireActive(CookingSession session) {
        if (!session.isActive()) {
            throw ApiException.conflict("This cooking session has already ended");
        }
    }

    private Optional<CookingTimer> findTimer(CookingSession session, int stepIndex) {
        return session.getTimers().stream().filter(t -> t.getStepIndex().equals(stepIndex)).findFirst();
    }

    private int totalSteps(CookingSession session) {
        return session.getRecipe().getSteps().size();
    }

    private User requireUser(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> ApiException.unauthorized("Please sign in"));
    }

    private String uniqueCode() {
        for (int attempt = 0; attempt < 20; attempt++) {
            StringBuilder sb = new StringBuilder(6);
            for (int i = 0; i < 6; i++) sb.append(CODE_ALPHABET.charAt(RANDOM.nextInt(CODE_ALPHABET.length())));
            String code = sb.toString();
            if (sessionRepository.findByJoinCode(code).isEmpty()) return code;
        }
        throw new IllegalStateException("Could not allocate a session code");
    }

    private static String label(CookingTimer timer) {
        return "the \"" + timer.getLabel() + "\" timer";
    }

    private static String topic(Long sessionId) {
        return "/topic/cooking-sessions/" + sessionId;
    }

}
