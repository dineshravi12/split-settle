package com.splitsettle.api;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.broker.AbstractBrokerMessageHandler;
import org.springframework.messaging.simp.broker.SimpleBrokerMessageHandler;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.datasource.url=jdbc:h2:mem:realtime;DB_CLOSE_DELAY=-1")
class RealtimeIntegrationTest {

    @LocalServerPort private int port;
    @Autowired private TestRestTemplate rest;
    @Autowired @Qualifier("simpleBrokerMessageHandler") private AbstractBrokerMessageHandler broker;

    private final WebSocketStompClient stompClient = createStompClient();
    private final List<StompSession> sessions = new ArrayList<>();

    @AfterEach
    void disconnect() {
        sessions.stream().filter(StompSession::isConnected).forEach(StompSession::disconnect);
    }

    @Test
    void membersReceiveGroupActivityOnceItIsCommitted() throws Exception {
        Session alice = register("Alice", "alice.rt@example.com");
        Session bob = register("Bob", "bob.rt@example.com");
        long groupId = createGroup(alice, "Live trip");
        post(alice, "/api/groups/" + groupId + "/members", "{\"email\":\"bob.rt@example.com\"}");

        BlockingQueue<Map<String, Object>> events = subscribe(connect(bob.token(), new ErrorRecorder()), groupId);
        post(alice, "/api/expenses", String.format(
                "{\"groupId\":%d,\"description\":\"Pizza\",\"amount\":300.00,\"category\":\"Food\",\"paidBy\":%d}",
                groupId, alice.userId()));

        Map<String, Object> event = events.poll(5, TimeUnit.SECONDS);
        assertThat(event).isNotNull();
        assertThat(event.get("type")).isEqualTo("EXPENSE_ADDED");
        assertThat(event.get("actorName")).isEqualTo("Alice");
        assertThat(event.get("description")).isEqualTo("Pizza");
        assertThat(((Number) event.get("amount")).doubleValue()).isEqualTo(300.0);
        assertThat(event.get("createdAt")).isInstanceOf(String.class);
    }

    @Test
    void invalidTokensOutsidersAndForeignOriginsAreRejected() throws Exception {
        Session owner = register("Owner", "owner.rt@example.com");
        Session outsider = register("Outsider", "outsider.rt@example.com");
        long groupId = createGroup(owner, "Private");

        ErrorRecorder badToken = new ErrorRecorder();
        assertThatThrownBy(() -> connect("not-a-jwt", badToken)).isInstanceOf(ExecutionException.class);
        assertThat(badToken.message.get(5, TimeUnit.SECONDS)).isEqualTo("Invalid token");

        ErrorRecorder denied = new ErrorRecorder();
        StompSession session = connect(outsider.token(), denied);
        session.subscribe("/topic/groups/" + groupId, new QueueingHandler(new LinkedBlockingQueue<>()));
        assertThat(denied.message.get(5, TimeUnit.SECONDS))
                .isEqualTo("Not allowed to subscribe to /topic/groups/" + groupId);

        WebSocketHttpHeaders foreign = new WebSocketHttpHeaders();
        foreign.setOrigin("https://evil.example");
        StompHeaders connect = new StompHeaders();
        connect.add("Authorization", "Bearer " + owner.token());
        assertThatThrownBy(() -> stompClient.connectAsync(url(), foreign, connect, new ErrorRecorder())
                .get(5, TimeUnit.SECONDS)).isInstanceOf(ExecutionException.class);
    }

    private StompSession connect(String token, ErrorRecorder handler) throws Exception {
        StompHeaders connect = new StompHeaders();
        connect.add("Authorization", "Bearer " + token);
        StompSession session = stompClient.connectAsync(url(), new WebSocketHttpHeaders(), connect, handler)
                .get(5, TimeUnit.SECONDS);
        sessions.add(session);
        return session;
    }

    private BlockingQueue<Map<String, Object>> subscribe(StompSession session, long groupId) throws Exception {
        String destination = "/topic/groups/" + groupId;
        BlockingQueue<Map<String, Object>> events = new LinkedBlockingQueue<>();
        session.subscribe(destination, new QueueingHandler(events));

        // The simple broker sends no RECEIPT, so wait until it has registered the subscription
        var probe = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
        probe.setDestination(destination);
        var message = MessageBuilder.createMessage(new byte[0], probe.getMessageHeaders());
        var registry = ((SimpleBrokerMessageHandler) broker).getSubscriptionRegistry();
        long deadline = System.currentTimeMillis() + 5000;
        while (registry.findSubscriptions(message).isEmpty()) {
            assertThat(System.currentTimeMillis()).as("subscription registered").isLessThan(deadline);
            Thread.sleep(20);
        }
        return events;
    }

    private String url() {
        return "ws://localhost:" + port + "/ws";
    }

    private static WebSocketStompClient createStompClient() {
        WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
        client.setMessageConverter(new MappingJackson2MessageConverter());
        client.setDefaultHeartbeat(new long[] {0, 0});
        return client;
    }

    private record Session(String token, long userId) {}

    private Session register(String name, String email) {
        JsonNode body = post(null, "/api/auth/register",
                String.format("{\"name\":\"%s\",\"email\":\"%s\",\"password\":\"secret123\"}", name, email));
        return new Session(body.get("token").asText(), body.get("userId").asLong());
    }

    private long createGroup(Session session, String name) {
        return post(session, "/api/groups", "{\"name\":\"" + name + "\"}").get("id").asLong();
    }

    private JsonNode post(Session session, String path, String json) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (session != null) {
            headers.setBearerAuth(session.token());
        }
        var response = rest.exchange(path, HttpMethod.POST, new HttpEntity<>(json, headers), JsonNode.class);
        assertThat(response.getStatusCode().is2xxSuccessful()).as("POST %s", path).isTrue();
        return response.getBody();
    }

    private static final class QueueingHandler implements StompFrameHandler {
        private final BlockingQueue<Map<String, Object>> queue;

        QueueingHandler(BlockingQueue<Map<String, Object>> queue) {
            this.queue = queue;
        }

        @Override
        public Type getPayloadType(StompHeaders headers) {
            return Map.class;
        }

        @Override
        @SuppressWarnings("unchecked")
        public void handleFrame(StompHeaders headers, Object payload) {
            queue.add((Map<String, Object>) payload);
        }
    }

    /** Captures the server's ERROR frame message. */
    private static final class ErrorRecorder extends StompSessionHandlerAdapter {
        final CompletableFuture<String> message = new CompletableFuture<>();

        @Override
        public Type getPayloadType(StompHeaders headers) {
            return Void.class;
        }

        @Override
        public void handleFrame(StompHeaders headers, Object payload) {
            message.complete(headers.getFirst("message"));
        }
    }
}
