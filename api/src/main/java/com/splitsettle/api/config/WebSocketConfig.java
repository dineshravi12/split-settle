package com.splitsettle.api.config;

import com.splitsettle.api.security.StompAuthInterceptor;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.messaging.StompSubProtocolErrorHandler;

import java.util.Arrays;

/** Live group updates: clients subscribe to /topic/groups/{id} over STOMP at /ws. */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final StompAuthInterceptor stompAuthInterceptor;
    private final TaskScheduler heartbeatScheduler;

    @Value("${app.cors.allowed-origins}")
    private String[] allowedOrigins;

    public WebSocketConfig(StompAuthInterceptor stompAuthInterceptor,
                           @Lazy @Qualifier("messageBrokerTaskScheduler") TaskScheduler heartbeatScheduler) {
        this.stompAuthInterceptor = stompAuthInterceptor;
        this.heartbeatScheduler = heartbeatScheduler;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOrigins(Arrays.stream(allowedOrigins).map(String::trim).filter(o -> !o.isEmpty())
                        .toArray(String[]::new));
        registry.setErrorHandler(new ClientErrorHandler());
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // Heartbeats keep idle connections alive through proxies and detect dead ones
        registry.enableSimpleBroker("/topic")
                .setHeartbeatValue(new long[] {10_000, 10_000})
                .setTaskScheduler(heartbeatScheduler);
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(stompAuthInterceptor);
    }

    /** Sends a readable reason for auth failures instead of internal channel details, then the session closes. */
    private static final class ClientErrorHandler extends StompSubProtocolErrorHandler {
        @Override
        public Message<byte[]> handleClientMessageProcessingError(Message<byte[]> clientMessage, Throwable ex) {
            Throwable cause = NestedExceptionUtils.getMostSpecificCause(ex);
            boolean authFailure = cause instanceof AuthenticationException || cause instanceof AccessDeniedException;
            return super.handleClientMessageProcessingError(clientMessage,
                    new IllegalStateException(authFailure ? cause.getMessage() : "Request could not be processed"));
        }
    }
}
