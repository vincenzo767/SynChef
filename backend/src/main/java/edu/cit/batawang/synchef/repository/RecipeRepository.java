package edu.cit.batawang.synchef.repository;

import edu.cit.batawang.synchef.model.Recipe;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface RecipeRepository extends JpaRepository<Recipe, Long>, JpaSpecificationExecutor<Recipe> {

    Optional<Recipe> findByCatalogNumber(Integer catalogNumber);

    @Query("SELECT r.sourceRef FROM Recipe r WHERE r.sourceRef IS NOT NULL")
    List<String> findAllSourceRefs();

    List<Recipe> findByCatalogNumberIn(Collection<Integer> catalogNumbers);

    @Query("SELECT r FROM Recipe r WHERE r.country.code = :countryCode ORDER BY r.name")
    List<Recipe> findByCountryCode(@Param("countryCode") String countryCode);

    @Query("SELECT DISTINCT r.region FROM Recipe r WHERE r.region IS NOT NULL ORDER BY r.region")
    List<String> findDistinctRegions();

    @Query("SELECT r.country.code, COUNT(r) FROM Recipe r GROUP BY r.country.code")
    List<Object[]> countByCountryCode();
}
