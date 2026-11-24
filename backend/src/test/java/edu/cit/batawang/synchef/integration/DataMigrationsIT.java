package edu.cit.batawang.synchef.integration;

import edu.cit.batawang.synchef.config.migration.DataMigrations;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Validates the one-time migrations against the real schema (H2, PostgreSQL mode).
 */
class DataMigrationsIT extends IntegrationTestSupport {

    @Autowired
    private DataMigrations migrations;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void legacyFavoritesAndPasswordsAreMigratedWithBackup() throws Exception {
        Account account = register();
        Long carbonara = jdbc.queryForObject("SELECT id FROM recipes WHERE catalog_number = 1", Long.class);
        Long padThai = jdbc.queryForObject("SELECT id FROM recipes WHERE catalog_number = 2", Long.class);

        // Simulate data written by the old clients: web catalogue id 1, Android offset id 10002.
        jdbc.update("DELETE FROM user_favorite_recipes WHERE user_id = ?", account.id());
        jdbc.update("INSERT INTO user_favorite_recipes (user_id, recipe_id) VALUES (?, 1)", account.id());
        jdbc.update("INSERT INTO user_favorite_recipes (user_id, recipe_id) VALUES (?, 10002)", account.id());
        jdbc.update("UPDATE users SET password = 'plain-legacy-pass' WHERE id = ?", account.id());
        jdbc.update("DELETE FROM app_data_migrations");
        jdbc.execute("DROP TABLE IF EXISTS user_favorite_recipes_backup_20261123");

        migrations.remapCatalogueFavorites();
        migrations.hashLegacyPasswords();

        List<Long> favorites = jdbc.queryForList(
                "SELECT recipe_id FROM user_favorite_recipes WHERE user_id = ? ORDER BY recipe_id", Long.class, account.id());
        assertThat(favorites).containsExactlyInAnyOrder(carbonara, padThai);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM user_favorite_recipes_backup_20261123", Integer.class))
                .isGreaterThanOrEqualTo(2);

        String stored = jdbc.queryForObject("SELECT password FROM users WHERE id = ?", String.class, account.id());
        assertThat(stored).startsWith("$2");
        login(account.email(), "plain-legacy-pass");

        // Idempotent: a second run changes nothing.
        migrations.remapCatalogueFavorites();
        assertThat(jdbc.queryForList("SELECT recipe_id FROM user_favorite_recipes WHERE user_id = ?", Long.class, account.id()))
                .containsExactlyInAnyOrderElementsOf(favorites);
    }
}
