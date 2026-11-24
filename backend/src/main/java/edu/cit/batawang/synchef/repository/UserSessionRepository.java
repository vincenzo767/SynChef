package edu.cit.batawang.synchef.repository;

import edu.cit.batawang.synchef.model.UserSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface UserSessionRepository extends JpaRepository<UserSession, Long> {

    Optional<UserSession> findByTokenHash(String tokenHash);

    List<UserSession> findByUserIdOrderByLastSeenAtDesc(Long userId);

    @Modifying
    @Query("DELETE FROM UserSession s WHERE s.userId = :userId")
    int deleteByUserId(@Param("userId") Long userId);

    @Modifying
    @Query("DELETE FROM UserSession s WHERE s.userId = :userId AND s.id <> :keepId")
    int deleteByUserIdExcept(@Param("userId") Long userId, @Param("keepId") Long keepId);

    @Modifying
    @Query("DELETE FROM UserSession s WHERE s.expiresAt < :now OR s.lastSeenAt < :idleCutoff")
    int deleteExpired(@Param("now") Instant now, @Param("idleCutoff") Instant idleCutoff);
}
