package edu.cit.batawang.synchef.service.scaling;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Component
public class MeasurementAwareRoundingStrategy implements IngredientRoundingStrategy {

    @Override
    public BigDecimal round(BigDecimal value, String unit) {
        String normalizedUnit = unit == null ? "" : unit.toLowerCase();

        if (normalizedUnit.contains("cup") || normalizedUnit.contains("tbsp") || normalizedUnit.contains("tsp")) {
            BigDecimal quarters = value.multiply(BigDecimal.valueOf(4)).setScale(0, RoundingMode.HALF_UP);
            return quarters.divide(BigDecimal.valueOf(4), 2, RoundingMode.HALF_UP);
        }

        return value.setScale(2, RoundingMode.HALF_UP);
    }
}
