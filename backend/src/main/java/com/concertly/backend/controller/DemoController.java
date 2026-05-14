package com.concertly.backend.controller;

import com.concertly.backend.service.DemoService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/demo")
public class DemoController {

    private final DemoService demoService;

    public DemoController(DemoService demoService) {
        this.demoService = demoService;
    }

    @PostMapping("/setup")
    public Map<String, Object> setup() {
        return demoService.setup();
    }
}
