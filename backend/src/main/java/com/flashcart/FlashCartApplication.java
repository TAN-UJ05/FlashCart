package com.flashcart;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class FlashCartApplication {
    public static void main(String[] args) {
        SpringApplication.run(FlashCartApplication.class, args);
    }
}
