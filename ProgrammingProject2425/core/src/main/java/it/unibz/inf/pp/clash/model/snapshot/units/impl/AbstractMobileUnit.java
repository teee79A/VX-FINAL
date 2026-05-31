package it.unibz.inf.pp.clash.model.snapshot.units.impl;

import it.unibz.inf.pp.clash.model.snapshot.units.MobileUnit;

public abstract class AbstractMobileUnit extends AbstractUnit implements MobileUnit {

    final UnitColor color;
    int attackCountDown = -1;
    int level = 1;
    final int initialAttackCountdown;
    final int attackDamage;

    protected AbstractMobileUnit(int health, UnitColor color, int initialAttackCountdown, int attackDamage) {
        super(health);
        this.color = color;
        this.initialAttackCountdown = initialAttackCountdown;
        this.attackDamage = attackDamage;
    }

    @Override
    public int getAttackDamage() {
        return attackDamage;
    }

    @Override
    public int getInitialAttackCountdown() {
        return initialAttackCountdown;
    }

    @Override
    public UnitColor getColor() {
        return color;
    }

    @Override
    public int getAttackCountdown() {
        return attackCountDown;
    }

    @Override
    public void setAttackCountdown(int attackCountDown) {
        this.attackCountDown = attackCountDown;
    }

    @Override
    public boolean matches(MobileUnit unit) {
        return this.getClass() == unit.getClass() && this.color == unit.getColor();
    }
}
