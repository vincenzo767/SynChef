package edu.cit.batawang.synchef.service;

import edu.cit.batawang.synchef.exception.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.Map;

/**
 * Stores user-uploaded images (profile photos, SynCook dish photos) under {@code app.upload.dir}.
 * The file type is verified from the content's magic bytes, not the client-declared MIME type,
 * and file names are random so they can't be guessed or used for path traversal.
 */
@Service
public class ProfileImageStorageService {

    public static final String PROFILE_IMAGES = "profile-images";
    public static final String SYNCOOK_IMAGES = "syncook-images";

    private static final long MAX_IMAGE_BYTES = 5L * 1024L * 1024L;
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Map<String, String> EXTENSIONS = Map.of(
            "image/jpeg", ".jpg",
            "image/png", ".png",
            "image/webp", ".webp",
            "image/gif", ".gif"
    );

    private final Path uploadRoot;

    public ProfileImageStorageService(@Value("${app.upload.dir:uploads}") String uploadDir) {
        this.uploadRoot = Paths.get(uploadDir).toAbsolutePath().normalize();
    }

    /** Backwards-compatible entry point used for profile photos. */
    public String store(MultipartFile file, Long userId) {
        return store(file, PROFILE_IMAGES, "user-" + userId);
    }

    public String store(MultipartFile file, String folder, String prefix) {
        if (!PROFILE_IMAGES.equals(folder) && !SYNCOOK_IMAGES.equals(folder)) {
            throw new IllegalArgumentException("Unknown upload folder");
        }
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("Choose an image to upload");
        }
        if (file.getSize() > MAX_IMAGE_BYTES) {
            throw ApiException.badRequest("Image is too large. Maximum allowed size is 5 MB.");
        }

        String detectedType = detectType(file);
        if (detectedType == null) {
            throw ApiException.badRequest("Unsupported image type. Use JPEG, PNG, WEBP or GIF.");
        }

        try {
            Path directory = uploadRoot.resolve(folder).normalize();
            Files.createDirectories(directory);
            String filename = prefix + "-" + HexFormat.of().formatHex(randomBytes()) + EXTENSIONS.get(detectedType);
            Path target = directory.resolve(filename).normalize();
            if (!target.startsWith(directory)) {
                throw ApiException.badRequest("Invalid file name");
            }
            try (InputStream in = file.getInputStream()) {
                Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
            }
            return "/uploads/" + folder + "/" + filename;
        } catch (IOException e) {
            throw new IllegalStateException("Failed to store image", e);
        }
    }

    /** Deletes a previously stored upload; ignores URLs that don't point into the upload folder. */
    public void deleteIfLocal(String url) {
        if (url == null || !url.startsWith("/uploads/")) return;
        Path target = uploadRoot.resolve(url.substring("/uploads/".length())).normalize();
        if (!target.startsWith(uploadRoot)) return;
        try {
            Files.deleteIfExists(target);
        } catch (IOException ignored) {
            // Orphaned file is harmless; it will not be referenced anymore.
        }
    }

    private static byte[] randomBytes() {
        byte[] bytes = new byte[12];
        RANDOM.nextBytes(bytes);
        return bytes;
    }

    private static String detectType(MultipartFile file) {
        byte[] head = new byte[12];
        try (InputStream in = file.getInputStream()) {
            int read = in.readNBytes(head, 0, head.length);
            if (read < 4) return null;
        } catch (IOException e) {
            return null;
        }
        if ((head[0] & 0xFF) == 0xFF && (head[1] & 0xFF) == 0xD8 && (head[2] & 0xFF) == 0xFF) return "image/jpeg";
        if ((head[0] & 0xFF) == 0x89 && head[1] == 'P' && head[2] == 'N' && head[3] == 'G') return "image/png";
        if (head[0] == 'G' && head[1] == 'I' && head[2] == 'F' && head[3] == '8') return "image/gif";
        if (head[0] == 'R' && head[1] == 'I' && head[2] == 'F' && head[3] == 'F'
                && head[8] == 'W' && head[9] == 'E' && head[10] == 'B' && head[11] == 'P') return "image/webp";
        return null;
    }
}
