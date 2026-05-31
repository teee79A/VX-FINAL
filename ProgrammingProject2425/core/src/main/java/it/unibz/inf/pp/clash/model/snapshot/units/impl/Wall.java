package it.unibz.inf.pp.clash.model.snapshot.units.impl;

import it.unibz.inf.pp.clash.model.snapshot.units.Unit;

public class Wall extends AbstractUnit implements Unit {

    public static final int HEALTH = 6;

    public Wall() {
        super(HEALTH);
    }

    @Override
    public String getPrintString() {
        return " (4) ";
    }
}
