package it.unibz.inf.pp.clash.model.formation;

import it.unibz.inf.pp.clash.model.snapshot.units.MobileUnit;
import it.unibz.inf.pp.clash.model.snapshot.units.Unit;

import java.util.List;
import java.util.Objects;

public final class Formation {
    private int rowIndex;
    private final int columnIndex;
    private final List<Unit> units;
    private final boolean isAttackingFormation;
    private int formationAttackDamage;


    public boolean shouldBeDestroyed() {
        return units.stream().allMatch(unit -> {
            if (unit instanceof MobileUnit mobileUnit) return mobileUnit.getAttackCountdown() <= 0;
            return false;
        });
    }

    public Formation(int rowIndex, int columnIndex, List<Unit> units, boolean isAttackingFormation) {
        this.rowIndex = rowIndex;
        this.columnIndex = columnIndex;
        this.units = units;
        this.isAttackingFormation = isAttackingFormation;
        this.formationAttackDamage = getInitialFormationAttackDamage();

        for (Unit unit : units) {
            if (unit instanceof MobileUnit mobileUnit) {
                mobileUnit.setAttackCountdown(mobileUnit.getInitialAttackCountdown());
            }
        }
    }

    // Returns true if the formation should be destroyed.
    public void update() {
        if (units.isEmpty()) {
            System.err.println("Formations should not be empty");
            return;
        }

        for (Unit unit : units) {
            if (unit instanceof MobileUnit mobileUnit) {
                mobileUnit.setAttackCountdown(mobileUnit.getAttackCountdown() - 1);
            }
        }
    }

    public int getInitialFormationAttackDamage() {
        if (!isAttackingFormation) return 0;
        return units.stream()
                .filter(unit -> unit instanceof MobileUnit)
                .mapToInt(unit -> ((MobileUnit) unit).getAttackDamage())
                .sum();
    }

    public int getFormationAttackDamage() {
        return formationAttackDamage;
    }

    public void setFormationAttackDamage(int formationAttackDamage) {
        this.formationAttackDamage = formationAttackDamage;
    }

    public void setRowIndex(int rowIndex) {
        this.rowIndex = rowIndex;
    }

    public int getRowIndex() {
        return rowIndex;
    }

    public int getColumnIndex() {
        return columnIndex;
    }

    public List<Unit> getUnits() {
        return units;
    }

    public boolean isAttackingFormation() {
        return isAttackingFormation;
    }

    @Override
    public boolean equals(Object obj) {
        if (obj == this) return true;
        if (obj == null || obj.getClass() != this.getClass()) return false;
        var that = (Formation) obj;
        return this.rowIndex == that.rowIndex &&
                this.columnIndex == that.columnIndex &&
                Objects.equals(this.units, that.units) &&
                this.isAttackingFormation == that.isAttackingFormation;
    }

    @Override
    public int hashCode() {
        return Objects.hash(rowIndex, columnIndex, units, isAttackingFormation);
    }

    @Override
    public String toString() {
        return "Formation[" +
                "rowIndex=" + rowIndex + ", " +
                "columnIndex=" + columnIndex + ", " +
                "units=" + units + ", " +
                "isAttackingFormation=" + isAttackingFormation + ']';
    }


}
