package edu.cit.batawang.synchef.service;

import edu.cit.batawang.synchef.exception.ApiException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SynCookImageValidationTest {

    @Test
    void acceptsUploadsHttpsAndLegacyDataUrls() {
        assertThat(SynCookService.validateImage("/uploads/syncook-images/dish-1-abc.jpg"))
                .isEqualTo("/uploads/syncook-images/dish-1-abc.jpg");
        assertThat(SynCookService.validateImage("https://images.example.com/a.jpg")).startsWith("https://");
        assertThat(SynCookService.validateImage("data:image/png;base64,iVBORw0KGgo=")).startsWith("data:image/png");
        assertThat(SynCookService.validateImage("  ")).isNull();
    }

    @Test
    void rejectsScriptsTraversalAndForeignSchemes() {
        assertThatThrownBy(() -> SynCookService.validateImage("javascript:alert(1)")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> SynCookService.validateImage("data:text/html;base64,PHNjcmlwdD4=")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> SynCookService.validateImage("/uploads/syncook-images/../../etc/passwd")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> SynCookService.validateImage("ftp://example.com/a.png")).isInstanceOf(ApiException.class);
    }
}
