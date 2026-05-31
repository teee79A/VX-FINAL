package it.unibz.inf.pp.clash.model.snapshot.units.impl;

import it.unibz.inf.pp.clash.model.snapshot.units.MobileUnit;

public class Unicorn extends AbstractMobileUnit implements MobileUnit {

    public static final int HEALTH = 3;
    public static final int ATTACK = 4;
    public static final int ATTACK_COUNTDOWN = 4;

    public Unicorn(UnitColor color) {
        super(HEALTH, color, ATTACK_COUNTDOWN, ATTACK);
    }


    @Override
    public String getPrintString() {
        return "(3-" + this.getColor().getPrintString() + ")";
    }
}
