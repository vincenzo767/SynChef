package edu.cit.batawang.synchef.repository;

import edu.cit.batawang.synchef.model.RecipeReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface RecipeReportRepository extends JpaRepository<RecipeReport, Long> {
    List<RecipeReport> findAllByOrderByReportDateDesc();

    List<RecipeReport> findByRecipeOwnerIdOrderByReportDateDesc(Long recipeOwnerId);

    boolean existsByReporterIdAndRecipeId(Long reporterId, Long recipeId);

    long countByStatus(String status);

    @Query("SELECT r.reportDate FROM RecipeReport r WHERE r.reportDate >= :since")
    List<LocalDateTime> findReportDatesSince(@Param("since") LocalDateTime since);
}
