package edu.cit.batawang.synchef.repository;

import edu.cit.batawang.synchef.model.SynCookComment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface SynCookCommentRepository extends JpaRepository<SynCookComment, Long> {
    List<SynCookComment> findByRecipeIdOrderByCreatedAtAsc(Long recipeId);

    long countByRecipeId(Long recipeId);

    @Modifying
    @Query("DELETE FROM SynCookComment c WHERE c.recipe.id = :recipeId")
    void deleteByRecipeId(@Param("recipeId") Long recipeId);

    @Modifying
    @Query("DELETE FROM SynCookComment c WHERE c.authorId = :authorId")
    void deleteByAuthorId(@Param("authorId") Long authorId);

    @Query("SELECT c.recipe.id, COUNT(c) FROM SynCookComment c WHERE c.recipe.id IN :recipeIds GROUP BY c.recipe.id")
    List<Object[]> countByRecipeIds(@Param("recipeIds") Collection<Long> recipeIds);

    @Query("SELECT c FROM SynCookComment c JOIN FETCH c.recipe ORDER BY c.createdAt DESC")
    List<SynCookComment> findAllWithRecipeOrderByCreatedAtDesc();
}
