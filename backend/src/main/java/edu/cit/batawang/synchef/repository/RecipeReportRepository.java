package edu.cit.batawang.synchef.repository;

import edu.cit.batawang.synchef.model.RecipeReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RecipeReportRepository extends JpaRepository<RecipeReport, Long> {
    List<RecipeReport> findAllByOrderByReportDateDesc();
    boolean existsByReporterIdAndRecipeId(Long reporterId, Long recipeId);
    long countByStatus(String status);
}
