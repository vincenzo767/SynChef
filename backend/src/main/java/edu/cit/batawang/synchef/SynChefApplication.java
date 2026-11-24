package edu.cit.batawang.synchef;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * SynChef — unified web platform API (real-time cooking, collaboration, global recipes).
 */
@SpringBootApplication
@ConfigurationPropertiesScan
@EnableScheduling
public class SynChefApplication {

    public static void main(String[] args) {
        SpringApplication.run(SynChefApplication.class, args);
    }
}
