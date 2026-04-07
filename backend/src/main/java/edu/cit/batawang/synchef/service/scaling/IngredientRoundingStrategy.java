package edu.cit.batawang.synchef.service.scaling;

import java.math.BigDecimal;

public interface IngredientRoundingStrategy {
    BigDecimal round(BigDecimal value, String unit);
}
