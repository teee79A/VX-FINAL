package it.unibz.inf.pp.clash.model.snapshot.units.impl;

import it.unibz.inf.pp.clash.model.snapshot.units.MobileUnit;

public class Butterfly extends AbstractMobileUnit implements MobileUnit {

    public static final int HEALTH = 5;
    public static final int ATTACK = 1;
    public static final int ATTACK_COUNTDOWN = 2;

    public Butterfly(MobileUnit.UnitColor color) {
        super(HEALTH, color, ATTACK_COUNTDOWN, ATTACK);
    }

    @Override
    public String getPrintString() {
        return "(1-" + this.getColor().getPrintString() + ")";
    }
}
