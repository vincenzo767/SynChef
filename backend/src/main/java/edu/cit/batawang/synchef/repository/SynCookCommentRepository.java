package edu.cit.batawang.synchef.repository;

import edu.cit.batawang.synchef.model.SynCookComment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface SynCookCommentRepository extends JpaRepository<SynCookComment, Long> {
    List<SynCookComment> findByRecipeIdOrderByCreatedAtAsc(Long recipeId);

    long countByRecipeId(Long recipeId);

    void deleteByRecipeId(Long recipeId);

    @Query("SELECT c FROM SynCookComment c JOIN FETCH c.recipe ORDER BY c.createdAt DESC")
    List<SynCookComment> findAllWithRecipeOrderByCreatedAtDesc();
}
