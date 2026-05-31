package it.unibz.inf.pp.clash.model.snapshot.units.impl;

import it.unibz.inf.pp.clash.model.snapshot.units.MobileUnit;

public class Fairy extends AbstractMobileUnit implements MobileUnit {

    public static final int HEALTH = 2;
    public static final int ATTACK = 3;
    public static final int ATTACK_COUNTDOWN = 3;

    public Fairy(UnitColor color) {
        super(HEALTH, color, ATTACK_COUNTDOWN, ATTACK);
    }

    @Override
    public String getPrintString() {
        return "(2-" + this.getColor().getPrintString() + ")";
    }
}
