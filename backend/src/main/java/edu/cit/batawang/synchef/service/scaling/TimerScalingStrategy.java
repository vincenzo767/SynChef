package edu.cit.batawang.synchef.service.scaling;

public interface TimerScalingStrategy {
    Integer scale(Integer originalTimerSeconds, double scalingFactor);
}
