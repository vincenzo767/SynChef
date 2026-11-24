package edu.cit.batawang.synchef.controller;

import edu.cit.batawang.synchef.dto.RecipeDtos.CountryResponse;
import edu.cit.batawang.synchef.dto.RecipeDtos.RecipeSummary;
import edu.cit.batawang.synchef.service.RecipeCatalogService;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.List;

/**
 * Countries for the Global Flavor Map, with the number of catalogue recipes for each.
 */
@RestController
@RequestMapping("/api/countries")
@RequiredArgsConstructor
@Validated
public class CountryController {

    private final RecipeCatalogService catalogService;

    @GetMapping
    public ResponseEntity<List<CountryResponse>> getAllCountries() {
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)))
                .body(catalogService.countries());
    }

    @GetMapping("/code/{code}")
    public CountryResponse getCountryByCode(@PathVariable @Size(max = 10) String code) {
        return catalogService.country(code);
    }

    @GetMapping("/code/{code}/recipes")
    public List<RecipeSummary> recipes(@PathVariable @Size(max = 10) String code) {
        return catalogService.byCountry(code);
    }
}
