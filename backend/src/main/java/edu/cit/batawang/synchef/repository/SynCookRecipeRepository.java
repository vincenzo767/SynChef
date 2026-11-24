package edu.cit.batawang.synchef.repository;

import edu.cit.batawang.synchef.model.SynCookRecipe;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SynCookRecipeRepository extends JpaRepository<SynCookRecipe, Long> {
    List<SynCookRecipe> findByPrivacyOrderByCreatedAtDesc(String privacy);

    List<SynCookRecipe> findByOwnerIdOrderByUpdatedAtDesc(Long ownerId);

    @Query("""
        SELECT r FROM SynCookRecipe r
        WHERE r.privacy = 'PUBLIC' AND LOWER(r.country) = LOWER(:country)
        ORDER BY r.createdAt DESC
    """)
    List<SynCookRecipe> findPublicByCountry(@Param("country") String country);

    List<SynCookRecipe> findByOwnerId(Long ownerId);

    long countByPrivacy(String privacy);
}
