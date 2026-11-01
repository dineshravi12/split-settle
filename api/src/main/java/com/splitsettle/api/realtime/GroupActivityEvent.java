package com.splitsettle.api.realtime;

import com.splitsettle.api.dto.ActivityDTO;

public record GroupActivityEvent(Long groupId, ActivityDTO activity) {
}
