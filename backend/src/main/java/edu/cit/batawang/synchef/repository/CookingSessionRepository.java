package edu.cit.batawang.synchef.repository;

import edu.cit.batawang.synchef.model.CookingSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CookingSessionRepository extends JpaRepository<CookingSession, Long> {

    Optional<CookingSession> findByJoinCode(String joinCode);

    @Query("""
        SELECT DISTINCT s FROM CookingSession s JOIN FETCH s.recipe
        LEFT JOIN s.participants p
        WHERE s.status = :status AND (s.hostUserId = :userId OR p.userId = :userId)
        ORDER BY s.updatedAt DESC
    """)
    List<CookingSession> findForUserByStatus(@Param("userId") Long userId, @Param("status") String status);

    @Query("""
        SELECT s FROM CookingSession s JOIN FETCH s.recipe
        WHERE s.hostUserId = :userId AND s.status = 'ACTIVE' AND s.recipe.id = :recipeId
        ORDER BY s.updatedAt DESC
    """)
    List<CookingSession> findActiveByHostAndRecipe(@Param("userId") Long userId, @Param("recipeId") Long recipeId);

    List<CookingSession> findByHostUserId(Long userId);

    @Query("SELECT s.startedAt FROM CookingSession s WHERE s.startedAt >= :since")
    List<java.time.Instant> findStartedAtSince(@Param("since") java.time.Instant since);
}
