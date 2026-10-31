package com.splitsettle.api.service;

import com.splitsettle.api.dto.SettlementDTO;
import com.splitsettle.api.entity.Expense;
import com.splitsettle.api.entity.ExpenseSplit;
import com.splitsettle.api.entity.Group;
import com.splitsettle.api.entity.GroupMember;
import com.splitsettle.api.entity.Payment;
import com.splitsettle.api.entity.User;
import com.splitsettle.api.exception.ResourceNotFoundException;
import com.splitsettle.api.repository.ExpenseSplitRepository;
import com.splitsettle.api.repository.GroupMemberRepository;
import com.splitsettle.api.repository.GroupRepository;
import com.splitsettle.api.repository.PaymentRepository;
import com.splitsettle.api.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SettlementServiceTest {

    private static final Long GROUP_ID = 10L;

    @Mock private ExpenseSplitRepository expenseSplitRepository;
    @Mock private PaymentRepository paymentRepository;
    @Mock private GroupMemberRepository groupMemberRepository;
    @Mock private GroupRepository groupRepository;
    @Mock private UserRepository userRepository;
    @Mock private GroupAccessService groupAccess;
    @Mock private ActivityService activityService;

    @InjectMocks private SettlementService settlementService;

    private final User alice = user(1L, "Alice");
    private final User bob = user(2L, "Bob");
    private final User carol = user(3L, "Carol");

    @Test
    void routesDebtThroughIntermediaryAsSingleTransfer() {
        givenLedger(List.of(alice, bob, carol),
                List.of(split(bob, alice, "100.00"), split(carol, bob, "100.00")),
                List.of());

        List<SettlementDTO> settlements = settlementService.calculateSettlements(GROUP_ID, alice.getId());

        assertThat(settlements).singleElement().satisfies(s -> {
            assertThat(s.getFromId()).isEqualTo(alice.getId());
            assertThat(s.getToId()).isEqualTo(carol.getId());
            assertThat(s.getAmount()).isEqualByComparingTo("100.00");
        });
    }

    @Test
    void settleUpRecordsPaymentForNettedAmount() {
        // Alice paid 200 split with Bob, Bob paid 80 split with Alice: Bob owes Alice 60 net
        givenLedger(List.of(alice, bob),
                List.of(split(alice, alice, "100.00"), split(alice, bob, "100.00"),
                        split(bob, alice, "40.00"), split(bob, bob, "40.00")),
                List.of());
        when(groupRepository.getReferenceById(GROUP_ID)).thenReturn(Group.builder().id(GROUP_ID).build());
        when(userRepository.getReferenceById(bob.getId())).thenReturn(bob);
        when(userRepository.getReferenceById(alice.getId())).thenReturn(alice);

        settlementService.settleUp(GROUP_ID, bob.getId(), alice.getId(), bob.getId());

        ArgumentCaptor<Payment> saved = ArgumentCaptor.forClass(Payment.class);
        verify(paymentRepository).save(saved.capture());
        assertThat(saved.getValue().getFromUser()).isEqualTo(bob);
        assertThat(saved.getValue().getToUser()).isEqualTo(alice);
        assertThat(saved.getValue().getAmount()).isEqualByComparingTo("60.00");
    }

    @Test
    void recordedPaymentClearsBalance() {
        givenLedger(List.of(alice, bob),
                List.of(split(alice, bob, "100.00"), split(bob, alice, "40.00")),
                List.of(payment(bob, alice, "60.00")));

        assertThat(settlementService.calculateSettlements(GROUP_ID, alice.getId())).isEmpty();
    }

    @Test
    void onlyPayerOrReceiverCanSettle() {
        assertThatThrownBy(() -> settlementService.settleUp(GROUP_ID, bob.getId(), alice.getId(), carol.getId()))
                .isInstanceOf(IllegalArgumentException.class);
        verify(paymentRepository, never()).save(any());
    }

    @Test
    void settleUpFailsWhenNothingIsOwed() {
        givenLedger(List.of(alice, bob), List.of(), List.of());

        assertThatThrownBy(() -> settlementService.settleUp(GROUP_ID, bob.getId(), alice.getId(), bob.getId()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void nonMembersCannotReadSettlements() {
        doThrow(new ResourceNotFoundException("Group not found")).when(groupAccess).requireMember(GROUP_ID, 99L);

        assertThatThrownBy(() -> settlementService.calculateSettlements(GROUP_ID, 99L))
                .isInstanceOf(ResourceNotFoundException.class);
        verifyNoInteractions(expenseSplitRepository, paymentRepository);
    }

    @Test
    void simplifyPairsLargestDebtorWithLargestCreditor() {
        Map<Long, BigDecimal> balances = Map.of(
                1L, new BigDecimal("-50.00"),
                2L, new BigDecimal("-30.00"),
                3L, new BigDecimal("80.00"));

        assertThat(SettlementService.simplify(balances)).containsExactly(
                new SettlementService.Transfer(1L, 3L, new BigDecimal("50.00")),
                new SettlementService.Transfer(2L, 3L, new BigDecimal("30.00")));
    }

    private void givenLedger(List<User> members, List<ExpenseSplit> splits, List<Payment> payments) {
        when(groupMemberRepository.findByGroup_Id(GROUP_ID))
                .thenReturn(members.stream().map(u -> GroupMember.builder().user(u).build()).toList());
        when(expenseSplitRepository.findByExpense_Group_Id(GROUP_ID)).thenReturn(splits);
        when(paymentRepository.findByGroup_Id(GROUP_ID)).thenReturn(payments);
    }

    private static User user(Long id, String name) {
        return User.builder().id(id).name(name).email(name.toLowerCase() + "@example.com").build();
    }

    private static ExpenseSplit split(User paidBy, User owedBy, String amount) {
        return ExpenseSplit.builder()
                .expense(Expense.builder().paidBy(paidBy).build())
                .user(owedBy)
                .amountOwed(new BigDecimal(amount))
                .isSettled(false)
                .build();
    }

    private static Payment payment(User from, User to, String amount) {
        return Payment.builder().fromUser(from).toUser(to).amount(new BigDecimal(amount)).build();
    }
}
