package com.flashcart.product.service;

import com.flashcart.common.exception.InvalidOperationException;
import com.flashcart.common.exception.ResourceNotFoundException;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
@Slf4j
public class ImageStorageService {

    private static final long MAX_FILE_SIZE = 5L * 1024 * 1024; // 5 MB
    private static final Set<String> ALLOWED_MIME_TYPES = Set.of(
            "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"
    );
    private static final Map<String, String> MIME_TO_EXTENSION = Map.of(
            "image/jpeg", ".jpg",
            "image/jpg", ".jpg",
            "image/png", ".png",
            "image/webp", ".webp",
            "image/gif", ".gif"
    );
    private static final Pattern SAFE_FILENAME = Pattern.compile("^[a-zA-Z0-9._-]+$");

    @Value("${flashcart.upload.directory:./uploads/images}")
    private String uploadDirectory;

    private Path uploadRoot;

    @PostConstruct
    public void init() {
        try {
            uploadRoot = Paths.get(uploadDirectory).toAbsolutePath().normalize();
            Files.createDirectories(uploadRoot);
            log.info("Image upload directory initialized at {}", uploadRoot);
        } catch (IOException ex) {
            throw new IllegalStateException("Could not initialize upload directory: " + uploadDirectory, ex);
        }
    }

    public String storeImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new InvalidOperationException("Image file must not be empty");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new InvalidOperationException("Image file size exceeds 5MB limit");
        }

        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_MIME_TYPES.contains(contentType.toLowerCase())) {
            throw new InvalidOperationException("Unsupported image type. Allowed types: JPEG, PNG, WEBP, GIF");
        }

        String ext = MIME_TO_EXTENSION.getOrDefault(contentType.toLowerCase(), ".jpg");
        String filename = UUID.randomUUID() + ext;

        try {
            if (uploadRoot == null) {
                init();
            }
            Path targetPath = uploadRoot.resolve(filename).normalize();
            if (!targetPath.startsWith(uploadRoot)) {
                throw new InvalidOperationException("Invalid target file path");
            }
            Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);
            return filename;
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to store image file", ex);
        }
    }

    public LoadedImage loadImage(String filename) {
        if (filename == null || !SAFE_FILENAME.matcher(filename).matches()) {
            throw new InvalidOperationException("Invalid image filename");
        }
        if (uploadRoot == null) {
            init();
        }
        Path filePath = uploadRoot.resolve(filename).normalize();
        if (!filePath.startsWith(uploadRoot)) {
            throw new ResourceNotFoundException("Image", filename);
        }

        if (!Files.exists(filePath) || !Files.isRegularFile(filePath)) {
            if (filename.startsWith("seed-") && filename.endsWith(".svg")) {
                ClassPathResource seedResource = new ClassPathResource("seed-images/" + filename);
                if (seedResource.exists()) {
                    return new LoadedImage(seedResource, "image/svg+xml");
                }
            }
            throw new ResourceNotFoundException("Image", filename);
        }

        try {
            Resource resource = new UrlResource(filePath.toUri());
            if (!resource.exists() || !resource.isReadable()) {
                throw new ResourceNotFoundException("Image", filename);
            }
            String contentType = Files.probeContentType(filePath);
            if (contentType == null) {
                contentType = "application/octet-stream";
            }
            return new LoadedImage(resource, contentType);
        } catch (MalformedURLException ex) {
            throw new ResourceNotFoundException("Image", filename);
        } catch (IOException ex) {
            return new LoadedImage(null, "application/octet-stream");
        }
    }

    public void deleteImageByUrl(String imageUrl) {
        if (imageUrl == null || !imageUrl.startsWith("/api/v1/images/")) {
            return;
        }
        String filename = imageUrl.substring("/api/v1/images/".length());
        if (!SAFE_FILENAME.matcher(filename).matches()) {
            return;
        }
        try {
            if (uploadRoot == null) {
                init();
            }
            Path filePath = uploadRoot.resolve(filename).normalize();
            if (filePath.startsWith(uploadRoot)) {
                Files.deleteIfExists(filePath);
            }
        } catch (IOException ex) {
            log.warn("Could not delete image file {}: {}", filename, ex.getMessage());
        }
    }

    public record LoadedImage(Resource resource, String contentType) {}
}
