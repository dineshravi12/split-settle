package com.splitsettle.api.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Turns a split request into exact per-user amounts that always add up to the expense total. */
final class SplitCalculator {
    private static final BigDecimal HUNDRED = new BigDecimal("100");

    private SplitCalculator() {
    }

    static Map<Long, BigDecimal> equal(BigDecimal amount, List<Long> userIds) {
        if (userIds.isEmpty()) {
            throw new IllegalArgumentException("Pick at least one person to split with");
        }
        BigDecimal share = amount.divide(BigDecimal.valueOf(userIds.size()), 2, RoundingMode.HALF_UP);
        Map<Long, BigDecimal> shares = new LinkedHashMap<>();
        userIds.forEach(userId -> shares.put(userId, share));
        return absorbRoundingRemainder(amount, shares);
    }

    static Map<Long, BigDecimal> byPercentage(BigDecimal amount, Map<Long, BigDecimal> percentages) {
        requireValues(percentages);
        if (sum(percentages).compareTo(HUNDRED) != 0) {
            throw new IllegalArgumentException("Percentages must add up to 100");
        }
        Map<Long, BigDecimal> shares = new LinkedHashMap<>();
        percentages.forEach((userId, percent) ->
                shares.put(userId, amount.multiply(percent).divide(HUNDRED, 2, RoundingMode.HALF_UP)));
        return absorbRoundingRemainder(amount, shares);
    }

    static Map<Long, BigDecimal> exact(BigDecimal amount, Map<Long, BigDecimal> amounts) {
        requireValues(amounts);
        if (sum(amounts).compareTo(amount) != 0) {
            throw new IllegalArgumentException("Split amounts must add up to the expense total");
        }
        Map<Long, BigDecimal> shares = new LinkedHashMap<>();
        amounts.forEach((userId, value) -> shares.put(userId, value.setScale(2, RoundingMode.UNNECESSARY)));
        return shares;
    }

    private static void requireValues(Map<Long, BigDecimal> values) {
        if (values.isEmpty()) {
            throw new IllegalArgumentException("Pick at least one person to split with");
        }
        if (values.values().stream().anyMatch(v -> v == null || v.signum() <= 0)) {
            throw new IllegalArgumentException("Split values must be greater than zero");
        }
    }

    private static Map<Long, BigDecimal> absorbRoundingRemainder(BigDecimal amount, Map<Long, BigDecimal> shares) {
        BigDecimal remainder = amount.subtract(sum(shares));
        if (remainder.signum() != 0) {
            Long last = shares.keySet().stream().reduce((first, second) -> second).orElseThrow();
            shares.merge(last, remainder, BigDecimal::add);
        }
        return shares;
    }

    private static BigDecimal sum(Map<Long, BigDecimal> values) {
        return values.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
