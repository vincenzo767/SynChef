package edu.cit.batawang.synchef.config.migration;

import edu.cit.batawang.synchef.service.DataSeederService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Runs once Hibernate has created/updated the schema, in a fixed order:
 * structural fixes → reference seed → catalogue seed → one-time data migrations → admin bootstrap.
 */
@Component
@Order(0)
@RequiredArgsConstructor
@Slf4j
public class StartupDataInitializer implements ApplicationRunner {

    private final DataMigrations migrations;
    private final DataSeederService referenceSeeder;
    private final CatalogSeeder catalogSeeder;

    @Override
    public void run(ApplicationArguments args) {
        migrations.applyStructuralFixes();
        referenceSeeder.seedReferenceData();
        catalogSeeder.seedCountries();
        catalogSeeder.seedRecipes();
        catalogSeeder.seedImportedRecipes();
        CatalogSeeder.ImageFixes fixes = catalogSeeder.imageFixes();
        java.util.Map<Integer, String[]> byNumber = new java.util.HashMap<>();
        fixes.byCatalogNumber().forEach((n, f) -> byNumber.put(n, new String[]{f.imageUrl(), f.imageSourceUrl()}));
        migrations.fixCatalogueImages(byNumber,
                new String[]{fixes.adobongSitaw().imageUrl(), fixes.adobongSitaw().imageSourceUrl()});
        migrations.hashLegacyPasswords();
        migrations.remapCatalogueFavorites();
        migrations.extractInlineSynCookImages();
        referenceSeeder.ensureAdminUser();
        log.info("Startup data initialization complete");
    }
}
