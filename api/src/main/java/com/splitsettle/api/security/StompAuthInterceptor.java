package com.splitsettle.api.security;

import com.splitsettle.api.service.GroupAccessService;
import io.jsonwebtoken.JwtException;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Component;

import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Authenticates STOMP sessions with the REST JWT (sent in the CONNECT frame) and limits subscriptions to group members. */
@Component
@RequiredArgsConstructor
public class StompAuthInterceptor implements ChannelInterceptor {

    private static final Pattern GROUP_TOPIC = Pattern.compile("^/topic/groups/(\\d{1,18})$");

    private final JwtUtil jwtUtil;
    private final UserDetailsServiceImpl userDetailsService;
    private final GroupAccessService groupAccess;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) {
            return message;
        }
        switch (accessor.getCommand()) {
            case CONNECT, STOMP -> accessor.setUser(authenticate(accessor.getFirstNativeHeader("Authorization")));
            case SUBSCRIBE -> authorizeSubscription(accessor);
            case SEND -> throw new AccessDeniedException("This connection is receive-only");
            default -> { }
        }
        return message;
    }

    private UsernamePasswordAuthenticationToken authenticate(String header) {
        if (header == null || !header.startsWith("Bearer ")) {
            throw new BadCredentialsException("Missing token");
        }
        String token = header.substring(7);
        try {
            UserDetails user = userDetailsService.loadUserByUsername(jwtUtil.extractUsername(token));
            if (!jwtUtil.validateToken(token, user)) {
                throw new BadCredentialsException("Invalid token");
            }
            return new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
        } catch (JwtException | IllegalArgumentException | UsernameNotFoundException ex) {
            throw new BadCredentialsException("Invalid token");
        }
    }

    private void authorizeSubscription(StompHeaderAccessor accessor) {
        String destination = Objects.toString(accessor.getDestination(), "");
        Matcher topic = GROUP_TOPIC.matcher(destination);
        Long userId = accessor.getUser() instanceof UsernamePasswordAuthenticationToken auth
                && auth.getPrincipal() instanceof UserPrincipal principal ? principal.getId() : null;
        if (!topic.matches() || !groupAccess.isMember(Long.valueOf(topic.group(1)), userId)) {
            throw new AccessDeniedException("Not allowed to subscribe to " + destination);
        }
    }
}
