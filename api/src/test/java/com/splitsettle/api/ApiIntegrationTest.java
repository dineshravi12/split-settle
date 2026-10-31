package com.splitsettle.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ApiIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;

    @Test
    void outsidersCannotReadOrJoinAnotherUsersGroup() throws Exception {
        Session owner = register("Owner", "owner@example.com");
        Session outsider = register("Outsider", "outsider@example.com");
        long groupId = createGroup(owner, "Goa Trip");

        perform(outsider, get("/api/groups/{id}", groupId)).andExpect(status().isNotFound());
        perform(outsider, get("/api/expenses/group/{id}", groupId)).andExpect(status().isNotFound());
        perform(outsider, get("/api/settlements/{id}", groupId)).andExpect(status().isNotFound());
        postJson(outsider, "/api/groups/" + groupId + "/members", "{\"email\":\"outsider@example.com\"}")
                .andExpect(status().isNotFound());

        perform(owner, get("/api/groups/{id}", groupId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.members.length()").value(1));
    }

    @Test
    void settleUpClearsTheNettedBalance() throws Exception {
        Session alice = register("Alice", "alice@example.com");
        Session bob = register("Bob", "bob@example.com");
        long groupId = createGroup(alice, "Flat");
        postJson(alice, "/api/groups/" + groupId + "/members", "{\"email\":\"bob@example.com\"}")
                .andExpect(status().isOk());
        addExpense(alice, groupId, "Groceries", "200.00", alice.userId());
        addExpense(bob, groupId, "Snacks", "80.00", bob.userId());

        perform(alice, get("/api/expenses/group/{id}", groupId))
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].createdAt").exists());
        perform(alice, get("/api/settlements/{id}", groupId))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].fromId").value((int) bob.userId()))
                .andExpect(jsonPath("$[0].toId").value((int) alice.userId()))
                .andExpect(jsonPath("$[0].amount").value(60.0));

        postJson(bob, "/api/settlements/settle", String.format(
                "{\"groupId\":%d,\"fromUserId\":%d,\"toUserId\":%d}", groupId, bob.userId(), alice.userId()))
                .andExpect(status().isOk());

        perform(alice, get("/api/settlements/{id}", groupId)).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void invalidOrMissingTokenGets401() throws Exception {
        mvc.perform(get("/api/groups").header("Authorization", "Bearer not-a-real-token"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/groups")).andExpect(status().isUnauthorized());
    }

    @Test
    void wrongPasswordGets401WithoutLeakingDetails() throws Exception {
        register("Dana", "dana@example.com");

        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"dana@example.com\",\"password\":\"wrong-password\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid email or password"));
    }

    @Test
    void registrationRequiresName() throws Exception {
        mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"noname@example.com\",\"password\":\"secret123\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Name is required"));
    }

    @Test
    void percentageSplitAssignsSharesAndBalances() throws Exception {
        Session ann = register("Ann", "ann@example.com");
        Session ben = register("Ben", "ben@example.com");
        long groupId = createGroup(ann, "Trip");
        addMember(ann, groupId, "ben@example.com");

        postJson(ann, "/api/expenses", expenseJson(groupId, "Hotel", "1000.00", ann.userId(), "PERCENTAGE",
                share(ann.userId(), "70"), share(ben.userId(), "30")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.splitType").value("PERCENTAGE"))
                .andExpect(jsonPath("$.splits[?(@.userId == %d)].amountOwed", ben.userId()).value(300.0))
                .andExpect(jsonPath("$.splits[?(@.userId == %d)].percentage", ben.userId()).value(30.0));

        perform(ben, get("/api/settlements/{id}", groupId))
                .andExpect(jsonPath("$[0].fromId").value((int) ben.userId()))
                .andExpect(jsonPath("$[0].amount").value(300.0));
    }

    @Test
    void invalidSplitsAreRejectedWithReadableMessages() throws Exception {
        Session cara = register("Cara", "cara@example.com");
        Session dev = register("Dev", "dev@example.com");
        long groupId = createGroup(cara, "Rent");
        addMember(cara, groupId, "dev@example.com");

        postJson(cara, "/api/expenses", expenseJson(groupId, "Rent", "500.00", cara.userId(), "EXACT",
                share(cara.userId(), "100"), share(dev.userId(), "300")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Split amounts must add up to the expense total"));
        postJson(cara, "/api/expenses", expenseJson(groupId, "Rent", "500.00", cara.userId(), "PERCENTAGE",
                share(cara.userId(), "60"), share(dev.userId(), "30")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Percentages must add up to 100"));
    }

    @Test
    void editingAnExpenseRecalculatesBalancesAndIsLogged() throws Exception {
        Session eli = register("Eli", "eli@example.com");
        Session fay = register("Fay", "fay@example.com");
        Session outsider = register("Gus", "gus@example.com");
        long groupId = createGroup(eli, "Dinner club");
        addMember(eli, groupId, "fay@example.com");

        long expenseId = read(postJson(eli, "/api/expenses",
                expenseJson(groupId, "Dinner", "600.00", eli.userId(), "EQUAL"))
                .andExpect(status().isOk())).get("id").asLong();
        perform(fay, get("/api/settlements/{id}", groupId)).andExpect(jsonPath("$[0].amount").value(300.0));

        perform(fay, put("/api/expenses/{id}", expenseId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(expenseJson(groupId, "Dinner + dessert", "600.00", eli.userId(), "EXACT",
                        share(eli.userId(), "100"), share(fay.userId(), "500"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description").value("Dinner + dessert"));
        perform(fay, get("/api/settlements/{id}", groupId)).andExpect(jsonPath("$[0].amount").value(500.0));

        perform(outsider, put("/api/expenses/{id}", expenseId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(expenseJson(groupId, "Hijack", "1.00", eli.userId(), "EQUAL")))
                .andExpect(status().isNotFound());

        perform(eli, get("/api/groups/{id}/activity", groupId))
                .andExpect(jsonPath("$.length()").value(4))
                .andExpect(jsonPath("$[0].type").value("EXPENSE_UPDATED"))
                .andExpect(jsonPath("$[0].actorId").value((int) fay.userId()))
                .andExpect(jsonPath("$[1].type").value("EXPENSE_ADDED"))
                .andExpect(jsonPath("$[2].type").value("MEMBER_ADDED"))
                .andExpect(jsonPath("$[2].targetName").value("Fay"))
                .andExpect(jsonPath("$[3].type").value("GROUP_CREATED"));
        perform(outsider, get("/api/groups/{id}/activity", groupId)).andExpect(status().isNotFound());
    }

    @Test
    void settleAllRecordsOnlyTheRequestersBalances() throws Exception {
        Session asha = register("Asha", "asha@example.com");
        Session bala = register("Bala", "bala@example.com");
        Session chitra = register("Chitra", "chitra@example.com");
        long groupId = createGroup(asha, "Flatmates");
        addMember(asha, groupId, "bala@example.com");
        addMember(asha, groupId, "chitra@example.com");
        // Net: Asha +170, Bala -40, Chitra -130 -> Chitra pays Asha 130, Bala pays Asha 40
        addExpense(asha, groupId, "Groceries", "300.00", asha.userId());
        addExpense(bala, groupId, "Wifi", "90.00", bala.userId());

        postJson(chitra, "/api/settlements/" + groupId + "/settle-all", "{}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.settled").value(1));

        perform(asha, get("/api/settlements/{id}", groupId))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].fromId").value((int) bala.userId()))
                .andExpect(jsonPath("$[0].amount").value(40.0));
        postJson(chitra, "/api/settlements/" + groupId + "/settle-all", "{}").andExpect(status().isNotFound());
    }

    private void addMember(Session session, long groupId, String email) throws Exception {
        postJson(session, "/api/groups/" + groupId + "/members", "{\"email\":\"" + email + "\"}")
                .andExpect(status().isOk());
    }

    @Test
    void upiIdIsOnlySharedWithWhoeverOwesTheMoney() throws Exception {
        Session hari = register("Hari", "hari@example.com");
        Session isha = register("Isha", "isha@example.com");
        long groupId = createGroup(hari, "Cab");
        addMember(hari, groupId, "isha@example.com");
        addExpense(hari, groupId, "Airport cab", "500.00", hari.userId());

        perform(hari, put("/api/users/me").contentType(MediaType.APPLICATION_JSON).content("{\"upiId\":\"hari@okaxis\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.upiId").value("hari@okaxis"));
        perform(hari, put("/api/users/me").contentType(MediaType.APPLICATION_JSON).content("{\"upiId\":\"hari@okaxis&am=1\"}"))
                .andExpect(status().isBadRequest());
        perform(hari, get("/api/users/me")).andExpect(jsonPath("$.upiId").value("hari@okaxis"));

        perform(isha, get("/api/settlements/{id}", groupId))
                .andExpect(jsonPath("$[0].toId").value((int) hari.userId()))
                .andExpect(jsonPath("$[0].toUpiId").value("hari@okaxis"));
        perform(hari, get("/api/settlements/{id}", groupId))
                .andExpect(jsonPath("$[0].toUpiId").doesNotExist());
    }

    private static String share(long userId, String value) {
        return String.format("{\"userId\":%d,\"value\":%s}", userId, value);
    }

    private static String expenseJson(long groupId, String description, String amount, long paidBy, String splitType,
                                      String... shares) {
        return String.format(
                "{\"groupId\":%d,\"description\":\"%s\",\"amount\":%s,\"category\":\"Food\",\"paidBy\":%d,"
                        + "\"splitType\":\"%s\",\"splits\":[%s]}",
                groupId, description, amount, paidBy, splitType, String.join(",", shares));
    }

    private record Session(String token, long userId) {}

    private Session register(String name, String email) throws Exception {
        String body = String.format("{\"name\":\"%s\",\"email\":\"%s\",\"password\":\"secret123\"}", name, email);
        JsonNode response = read(mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk()));
        return new Session(response.get("token").asText(), response.get("userId").asLong());
    }

    private long createGroup(Session session, String name) throws Exception {
        return read(postJson(session, "/api/groups", "{\"name\":\"" + name + "\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.members.length()").value(1))).get("id").asLong();
    }

    private void addExpense(Session session, long groupId, String description, String amount, long paidBy)
            throws Exception {
        postJson(session, "/api/expenses", String.format(
                "{\"groupId\":%d,\"description\":\"%s\",\"amount\":%s,\"category\":\"Food\",\"paidBy\":%d}",
                groupId, description, amount, paidBy))
                .andExpect(status().isOk());
    }

    private ResultActions perform(Session session,
                                  org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request)
            throws Exception {
        return mvc.perform(request.header("Authorization", "Bearer " + session.token()));
    }

    private ResultActions postJson(Session session, String url, String body) throws Exception {
        return perform(session, post(url).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private JsonNode read(ResultActions result) throws Exception {
        return json.readTree(result.andReturn().getResponse().getContentAsString());
    }
}
