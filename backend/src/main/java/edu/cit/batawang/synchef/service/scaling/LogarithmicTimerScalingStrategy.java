package edu.cit.batawang.synchef.service.scaling;

import org.springframework.stereotype.Component;

@Component
public class LogarithmicTimerScalingStrategy implements TimerScalingStrategy {

    @Override
    public Integer scale(Integer originalTimerSeconds, double scalingFactor) {
        if (originalTimerSeconds == null) {
            return null;
        }
        return (int) (originalTimerSeconds * Math.pow(scalingFactor, 0.3));
    }
}
