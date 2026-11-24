package edu.cit.batawang.synchef.config.migration;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.SecureRandom;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HexFormat;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Deliberate, documented schema and data migrations that {@code ddl-auto=update} cannot express.
 * <ul>
 *   <li><b>Structural fixes</b> are idempotent and run on every start.</li>
 *   <li><b>Data migrations</b> run once; each is recorded in {@code app_data_migrations} and backs
 *       up the rows it rewrites into a {@code *_backup_20261123} table (rollback = copy back).</li>
 * </ul>
 * Each migration is idempotent and runs once on startup.
 */
@Component
@Slf4j
public class DataMigrations {

    static final String HASH_LEGACY_PASSWORDS = "2026-11-23-hash-legacy-plaintext-passwords";
    static final String REMAP_FAVORITES = "2026-11-23-remap-catalogue-favorites";
    static final String EXTRACT_INLINE_IMAGES = "2026-11-23-extract-inline-syncook-images";
    static final String FIX_CATALOGUE_IMAGES = "2026-11-24-fix-catalogue-images";

    /** Mobile app stored catalogue favorites as (catalogNumber + 10000). */
    private static final long MOBILE_FALLBACK_OFFSET = 10_000L;
    private static final Pattern DATA_URL = Pattern.compile("^data:image/(png|jpeg|jpg|webp|gif);base64,(.+)$", Pattern.DOTALL);

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String SYNCOOK_RECIPES = "syncook_recipes";
    private static final String USER_NOTIFICATIONS = "user_notifications";
    private static final String FAVORITES = "user_favorite_recipes";

    private final JdbcTemplate jdbc;
    private final DataSource dataSource;
    private final PasswordEncoder passwordEncoder;
    private final TransactionTemplate tx;
    private final Path uploadRoot;

    public DataMigrations(JdbcTemplate jdbc, DataSource dataSource, PasswordEncoder passwordEncoder,
                          PlatformTransactionManager transactionManager,
                          @Value("${app.upload.dir:uploads}") String uploadDir) {
        this.jdbc = jdbc;
        this.dataSource = dataSource;
        this.passwordEncoder = passwordEncoder;
        this.tx = new TransactionTemplate(transactionManager);
        this.uploadRoot = Paths.get(uploadDir).toAbsolutePath().normalize();
    }

    // ── structural (every start) ────────────────────────────────────────────

    public void applyStructuralFixes() {
        jdbc.execute("CREATE TABLE IF NOT EXISTS app_data_migrations ("
                + "id VARCHAR(100) PRIMARY KEY, applied_at TIMESTAMP NOT NULL)");

        boolean postgres = isPostgres();
        if (postgres && tableExists(SYNCOOK_RECIPES)) {
            // Databases created with image_url varchar(1500) (pre-existing fix, kept).
            quietly("ALTER TABLE syncook_recipes ALTER COLUMN image_url TYPE TEXT");
        }
        // Columns that became optional for the curated catalogue (Hibernate never relaxes NOT NULL).
        dropNotNull("recipes", "prep_time_minutes");
        dropNotNull("recipes", "cook_time_minutes");
        dropNotNull("recipe_ingredients", "quantity");
        // Imported recipes may not publish a total time or a yield.
        dropNotNull("recipes", "total_time_minutes");
        dropNotNull("recipes", "default_servings");

        if (tableExists(USER_NOTIFICATIONS) && columnExists(USER_NOTIFICATIONS, "recipient_id")
                && columnExists(USER_NOTIFICATIONS, "sender_id")) {
            // Keep legacy/new notification column names in sync (pre-existing fix, kept).
            quietly("""
                UPDATE user_notifications
                SET recipient_id = COALESCE(recipient_id, recipient_user_id),
                    recipient_user_id = COALESCE(recipient_user_id, recipient_id),
                    sender_id = COALESCE(sender_id, sender_user_id),
                    sender_user_id = COALESCE(sender_user_id, sender_id)
                WHERE recipient_id IS NULL OR recipient_user_id IS NULL
                   OR (sender_id IS NULL AND sender_user_id IS NOT NULL)
                   OR (sender_user_id IS NULL AND sender_id IS NOT NULL)
                """);
        }
    }

    // ── one-time data migrations ────────────────────────────────────────────

    /**
     * Replaces catalogue photos that showed the wrong dish (or none) with the dish's Wikimedia
     * Commons photo. Only rows still carrying the original seeded URL (or no image) are changed,
     * so an image edited after seeding is never overwritten.
     */
    public void fixCatalogueImages(java.util.Map<Integer, String[]> byCatalogNumber, String[] adobongSitaw) {
        runOnce(FIX_CATALOGUE_IMAGES, () -> {
            backup("recipes", "recipe_images_backup_20261124", "SELECT id, image_url FROM recipes");
            int updated = 0;
            for (var entry : byCatalogNumber.entrySet()) {
                updated += jdbc.update("UPDATE recipes SET image_url = ?, image_source_url = ? "
                        + "WHERE catalog_number = ? AND (image_url IS NULL OR image_url LIKE 'https://images.unsplash.com/%')",
                        entry.getValue()[0], entry.getValue()[1], entry.getKey());
            }
            updated += jdbc.update("UPDATE recipes SET image_url = ?, image_source_url = ? "
                    + "WHERE name = 'Adobong Sitaw' AND catalog_number IS NULL AND image_url IS NULL",
                    adobongSitaw[0], adobongSitaw[1]);
            log.info("Replaced {} catalogue photos (backup: recipe_images_backup_20261124)", updated);
        });
    }

    /** Plaintext passwords from early builds are BCrypt-hashed in place (login keeps working). */
    public void hashLegacyPasswords() {
        runOnce(HASH_LEGACY_PASSWORDS, () -> {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT id, password FROM users WHERE password IS NOT NULL AND password <> ''");
            int upgraded = 0;
            for (Map<String, Object> row : rows) {
                String password = (String) row.get("password");
                if (!isBcrypt(password)) {
                    jdbc.update("UPDATE users SET password = ? WHERE id = ?",
                            passwordEncoder.encode(password), ((Number) row.get("id")).longValue());
                    upgraded++;
                }
            }
            log.info("Hashed {} legacy plaintext passwords", upgraded);
        });
    }

    /**
     * Favorites saved by the old clients referenced catalogue numbers (web: n, Android: n + 10000)
     * instead of database IDs. Rewrite them to the seeded recipes' IDs. Requires the catalogue seed.
     */
    public void remapCatalogueFavorites() {
        if (!tableExists(FAVORITES)) {
            markApplied(REMAP_FAVORITES);
            return;
        }
        Integer seeded = jdbc.queryForObject("SELECT COUNT(*) FROM recipes WHERE catalog_number IS NOT NULL", Integer.class);
        if (seeded == null || seeded == 0) {
            log.warn("Catalogue not seeded; favorites remap postponed");
            return;
        }
        runOnce(REMAP_FAVORITES, () -> {
            backup(FAVORITES, "user_favorite_recipes_backup_20261123", "SELECT * FROM user_favorite_recipes");
            Map<Long, Long> catalogToId = new java.util.HashMap<>();
            jdbc.query("SELECT id, catalog_number FROM recipes WHERE catalog_number IS NOT NULL",
                    (RowCallbackHandler) rs -> catalogToId.put(rs.getLong("catalog_number"), rs.getLong("id")));
            List<Long> userIds = jdbc.queryForList("SELECT DISTINCT user_id FROM user_favorite_recipes", Long.class);
            int changedUsers = 0;
            for (Long userId : userIds) {
                if (remapUserFavorites(userId, catalogToId)) changedUsers++;
            }
            log.info("Remapped catalogue favorites for {} users (backup: user_favorite_recipes_backup_20261123)", changedUsers);
        });
    }

    private boolean remapUserFavorites(Long userId, Map<Long, Long> catalogToId) {
        List<Long> current = jdbc.queryForList(
                "SELECT recipe_id FROM user_favorite_recipes WHERE user_id = ?", Long.class, userId);
        Set<Long> mapped = new LinkedHashSet<>();
        for (Long value : current) {
            if (value == null) continue;
            long catalog = value >= MOBILE_FALLBACK_OFFSET ? value - MOBILE_FALLBACK_OFFSET : value;
            mapped.add(catalogToId.getOrDefault(catalog, value));
        }
        if (new ArrayList<>(mapped).equals(current)) {
            return false;
        }
        jdbc.update("DELETE FROM user_favorite_recipes WHERE user_id = ?", userId);
        for (Long recipeId : mapped) {
            jdbc.update("INSERT INTO user_favorite_recipes (user_id, recipe_id) VALUES (?, ?)", userId, recipeId);
        }
        return true;
    }

    /** Moves base64 dish photos out of the database into the upload folder (smaller feed payloads). */
    public void extractInlineSynCookImages() {
        if (!tableExists(SYNCOOK_RECIPES)) {
            markApplied(EXTRACT_INLINE_IMAGES);
            return;
        }
        runOnce(EXTRACT_INLINE_IMAGES, () -> {
            backup(SYNCOOK_RECIPES, "syncook_images_backup_20261123",
                    "SELECT id, image_url FROM syncook_recipes WHERE image_url LIKE 'data:%'");
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT id, image_url FROM syncook_recipes WHERE image_url LIKE 'data:%'");
            int moved = 0;
            for (Map<String, Object> row : rows) {
                long id = ((Number) row.get("id")).longValue();
                String url = writeDataUrl(id, (String) row.get("image_url"));
                if (url != null) {
                    jdbc.update("UPDATE syncook_recipes SET image_url = ? WHERE id = ?", url, id);
                    moved++;
                }
            }
            log.info("Moved {} inline dish images to {}", moved, uploadRoot.resolve("syncook-images"));
        });
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private String writeDataUrl(long id, String dataUrl) {
        Matcher m = DATA_URL.matcher(dataUrl == null ? "" : dataUrl.trim());
        if (!m.matches()) return null;
        try {
            byte[] bytes = Base64.getMimeDecoder().decode(m.group(2));
            String ext = switch (m.group(1).toLowerCase(Locale.ROOT)) {
                case "png" -> ".png";
                case "webp" -> ".webp";
                case "gif" -> ".gif";
                default -> ".jpg";
            };
            byte[] random = new byte[6];
            RANDOM.nextBytes(random);
            Path dir = uploadRoot.resolve("syncook-images");
            Files.createDirectories(dir);
            String name = "dish-legacy-" + id + "-" + HexFormat.of().formatHex(random) + ext;
            Files.write(dir.resolve(name), bytes);
            return "/uploads/syncook-images/" + name;
        } catch (IllegalArgumentException | IOException e) {
            log.warn("Could not extract inline image of dish {}: {}", id, e.getMessage());
            return null;
        }
    }

    private void runOnce(String id, Runnable migration) {
        Integer done = jdbc.queryForObject("SELECT COUNT(*) FROM app_data_migrations WHERE id = ?", Integer.class, id);
        if (done != null && done > 0) return;
        tx.executeWithoutResult(status -> {
            migration.run();
            markApplied(id);
        });
        log.info("Applied data migration {}", id);
    }

    private void markApplied(String id) {
        Integer done = jdbc.queryForObject("SELECT COUNT(*) FROM app_data_migrations WHERE id = ?", Integer.class, id);
        if (done == null || done == 0) {
            jdbc.update("INSERT INTO app_data_migrations (id, applied_at) VALUES (?, CURRENT_TIMESTAMP)", id);
        }
    }

    /** Table names here are internal constants, never user input. */
    private void backup(String sourceTable, String backupTable, String select) {
        if (!tableExists(sourceTable) || tableExists(backupTable)) return;
        jdbc.execute("CREATE TABLE " + backupTable + " AS " + select);
    }

    private void dropNotNull(String table, String column) {
        if (tableExists(table) && columnExists(table, column) && !isNullable(table, column)) {
            quietly("ALTER TABLE " + table + " ALTER COLUMN " + column + " DROP NOT NULL");
        }
    }

    private void quietly(String sql) {
        try {
            jdbc.execute(sql);
        } catch (RuntimeException e) {
            log.warn("Schema fix skipped ({}): {}", sql.lines().findFirst().orElse(sql), e.getMessage());
        }
    }

    private static boolean isBcrypt(String value) {
        return value.startsWith("$2a$") || value.startsWith("$2b$") || value.startsWith("$2y$");
    }

    private boolean isPostgres() {
        return withMetadata(md -> md.getDatabaseProductName().toLowerCase(Locale.ROOT).contains("postgres"));
    }

    boolean tableExists(String table) {
        return withMetadata(md -> {
            for (String candidate : new String[]{table, table.toUpperCase(Locale.ROOT)}) {
                try (ResultSet rs = md.getTables(null, null, candidate, new String[]{"TABLE"})) {
                    if (rs.next()) return true;
                }
            }
            return false;
        });
    }

    private boolean columnExists(String table, String column) {
        return columnAttribute(table, column, rs -> true, false);
    }

    private boolean isNullable(String table, String column) {
        return columnAttribute(table, column, rs -> {
            try {
                return rs.getInt("NULLABLE") == DatabaseMetaData.columnNullable;
            } catch (SQLException e) {
                return true;
            }
        }, true);
    }

    private boolean columnAttribute(String table, String column, java.util.function.Predicate<ResultSet> read,
                                    boolean fallback) {
        return withMetadata(md -> {
            for (String[] names : new String[][]{{table, column},
                    {table.toUpperCase(Locale.ROOT), column.toUpperCase(Locale.ROOT)}}) {
                try (ResultSet rs = md.getColumns(null, null, names[0], names[1])) {
                    if (rs.next()) return read.test(rs);
                }
            }
            return fallback;
        });
    }

    private interface MetadataQuery<T> {
        T apply(DatabaseMetaData md) throws SQLException;
    }

    private <T> T withMetadata(MetadataQuery<T> query) {
        try (Connection connection = dataSource.getConnection()) {
            return query.apply(connection.getMetaData());
        } catch (SQLException e) {
            throw new IllegalStateException("Database metadata unavailable", e);
        }
    }
}
