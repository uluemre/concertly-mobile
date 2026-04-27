package com.concertly.backend.controller;

import com.concertly.backend.dto.request.CreateEventRequest;
import com.concertly.backend.dto.response.EventResponse;
import com.concertly.backend.service.EventService;
import com.concertly.backend.service.TicketmasterService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/events")
public class EventController {

    private final EventService eventService;
    private final TicketmasterService ticketmasterService;

    public EventController(EventService eventService, TicketmasterService ticketmasterService) {
        this.eventService = eventService;
        this.ticketmasterService = ticketmasterService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public EventResponse createEvent(@RequestBody CreateEventRequest request) {
        return eventService.createEvent(request);
    }

    @GetMapping
    public List<EventResponse> getEvents() {
        return eventService.getAllEvents();
    }

    @GetMapping("/{id}")
    public EventResponse getEvent(@PathVariable Long id) {
        return eventService.getEventById(id);
    }

    @PatchMapping("/{id}/approve")
    public EventResponse approveEvent(@PathVariable Long id) {
        return eventService.approveEvent(id);
    }

    @PostMapping("/sync")
    public String syncEvents() {
        int count = ticketmasterService.syncTurkeyEvents();
        return count + " etkinlik eklendi.";
    }
}