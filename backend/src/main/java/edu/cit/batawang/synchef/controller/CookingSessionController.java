package edu.cit.batawang.synchef.controller;

import edu.cit.batawang.synchef.dto.CookingDtos.CompleteStepRequest;
import edu.cit.batawang.synchef.dto.CookingDtos.CookingSessionView;
import edu.cit.batawang.synchef.dto.CookingDtos.JoinRequest;
import edu.cit.batawang.synchef.dto.CookingDtos.StartSessionRequest;
import edu.cit.batawang.synchef.dto.CookingDtos.StepRequest;
import edu.cit.batawang.synchef.security.AuthenticatedUser;
import edu.cit.batawang.synchef.security.RateLimiter;
import edu.cit.batawang.synchef.service.CookingSessionService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Real-time cooking sessions. Each command returns the new authoritative state, which is also
 * broadcast to every participant on {@code /topic/cooking-sessions/{id}}.
 */
@RestController
@RequestMapping("/api/cooking-sessions")
@RequiredArgsConstructor
@Validated
public class CookingSessionController {

    private final CookingSessionService sessions;
    private final RateLimiter rateLimiter;

    @PostMapping
    public CookingSessionView start(@AuthenticationPrincipal AuthenticatedUser user,
                                    @Valid @RequestBody StartSessionRequest request) {
        rateLimiter.check("cook-start:" + user.id(), 60);
        return sessions.start(user.id(), request);
    }

    @GetMapping("/active")
    public List<CookingSessionView> active(@AuthenticationPrincipal AuthenticatedUser user) {
        return sessions.activeFor(user.id());
    }

    @GetMapping("/history")
    public List<CookingSessionView> history(@AuthenticationPrincipal AuthenticatedUser user) {
        return sessions.historyFor(user.id());
    }

    @PostMapping("/join")
    public CookingSessionView join(@AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody JoinRequest request) {
        rateLimiter.check("cook-join:" + user.id(), 20);
        return sessions.join(request.code(), user.id());
    }

    @GetMapping("/{id}")
    public CookingSessionView get(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id) {
        return sessions.get(id, user.id());
    }

    @PostMapping("/{id}/step")
    public CookingSessionView goToStep(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id,
                                       @Valid @RequestBody StepRequest request) {
        return sessions.goToStep(id, user.id(), request.index());
    }

    @PostMapping("/{id}/steps/{index}/completion")
    public CookingSessionView completeStep(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id,
                                           @PathVariable @Min(0) int index,
                                           @Valid @RequestBody CompleteStepRequest request) {
        return sessions.setStepCompleted(id, user.id(), index, request.completed());
    }

    @PostMapping("/{id}/timers/{stepIndex}/start")
    public CookingSessionView startTimer(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id,
                                         @PathVariable @Min(0) int stepIndex) {
        return sessions.startTimer(id, user.id(), stepIndex);
    }

    @PostMapping("/{id}/timers/{stepIndex}/pause")
    public CookingSessionView pauseTimer(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id,
                                         @PathVariable @Min(0) int stepIndex) {
        return sessions.pauseTimer(id, user.id(), stepIndex);
    }

    @PostMapping("/{id}/timers/{stepIndex}/reset")
    public CookingSessionView resetTimer(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id,
                                         @PathVariable @Min(0) int stepIndex) {
        return sessions.resetTimer(id, user.id(), stepIndex);
    }

    @PostMapping("/{id}/share")
    public CookingSessionView share(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id) {
        return sessions.share(id, user.id());
    }

    @PostMapping("/{id}/leave")
    public CookingSessionView leave(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id) {
        return sessions.leave(id, user.id());
    }

    @PostMapping("/{id}/complete")
    public CookingSessionView complete(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id) {
        return sessions.complete(id, user.id());
    }

    @PostMapping("/{id}/abandon")
    public CookingSessionView abandon(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id) {
        return sessions.abandon(id, user.id());
    }
}
