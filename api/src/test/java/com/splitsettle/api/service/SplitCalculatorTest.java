package com.splitsettle.api.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SplitCalculatorTest {

    @Test
    void equalSplitGivesRoundingRemainderToLastPerson() {
        assertThat(SplitCalculator.equal(new BigDecimal("100.00"), List.of(1L, 2L, 3L)))
                .containsExactly(entry(1L, "33.33"), entry(2L, "33.33"), entry(3L, "33.34"));
        assertThat(SplitCalculator.equal(new BigDecimal("200.00"), List.of(1L, 2L, 3L)))
                .containsExactly(entry(1L, "66.67"), entry(2L, "66.67"), entry(3L, "66.66"));
    }

    @Test
    void percentageSplitAlwaysAddsUpToTheTotal() {
        assertThat(SplitCalculator.byPercentage(new BigDecimal("1000.00"),
                values(1L, "33.33", 2L, "33.33", 3L, "33.34")))
                .containsExactly(entry(1L, "333.30"), entry(2L, "333.30"), entry(3L, "333.40"));
        assertThat(SplitCalculator.byPercentage(new BigDecimal("100.01"), values(1L, "50", 2L, "50")))
                .containsExactly(entry(1L, "50.01"), entry(2L, "50.00"));
    }

    @Test
    void percentagesMustAddUpTo100() {
        assertThatThrownBy(() -> SplitCalculator.byPercentage(new BigDecimal("100.00"), values(1L, "60", 2L, "30")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("100");
    }

    @Test
    void exactAmountsMustMatchTheTotal() {
        assertThat(SplitCalculator.exact(new BigDecimal("500.00"), values(1L, "120.50", 2L, "379.50")))
                .containsExactly(entry(1L, "120.50"), entry(2L, "379.50"));
        assertThatThrownBy(() -> SplitCalculator.exact(new BigDecimal("500.00"), values(1L, "100", 2L, "300")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsEmptyOrNonPositiveShares() {
        assertThatThrownBy(() -> SplitCalculator.equal(new BigDecimal("10.00"), List.of()))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> SplitCalculator.exact(new BigDecimal("10.00"), values(1L, "10.00", 2L, "0")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private static Map<Long, BigDecimal> values(Object... idValuePairs) {
        Map<Long, BigDecimal> values = new LinkedHashMap<>();
        for (int i = 0; i < idValuePairs.length; i += 2) {
            values.put((Long) idValuePairs[i], new BigDecimal((String) idValuePairs[i + 1]));
        }
        return values;
    }

    private static Map.Entry<Long, BigDecimal> entry(Long userId, String amount) {
        return Map.entry(userId, new BigDecimal(amount));
    }
}
