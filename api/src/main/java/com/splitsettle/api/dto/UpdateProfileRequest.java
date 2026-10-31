package com.splitsettle.api.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateProfileRequest {
    /** Null clears it. The strict pattern also keeps the value safe to embed in upi:// links and QR codes. */
    @Size(max = 100, message = "UPI ID must be at most 100 characters")
    @Pattern(regexp = "^[A-Za-z0-9][A-Za-z0-9._-]{1,99}@[A-Za-z][A-Za-z0-9]{1,49}$",
            message = "Enter a valid UPI ID, like name@okaxis")
    private String upiId;
}
