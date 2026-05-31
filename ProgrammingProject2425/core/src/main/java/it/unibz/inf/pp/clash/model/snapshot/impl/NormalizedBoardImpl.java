package it.unibz.inf.pp.clash.model.snapshot.impl;

import it.unibz.inf.pp.clash.model.exceptions.CoordinatesOutOfBoardException;
import it.unibz.inf.pp.clash.model.formation.Formation;
import it.unibz.inf.pp.clash.model.snapshot.Board;
import it.unibz.inf.pp.clash.model.snapshot.Hero;
import it.unibz.inf.pp.clash.model.snapshot.NormalizedBoard;
import it.unibz.inf.pp.clash.model.snapshot.Snapshot;
import it.unibz.inf.pp.clash.model.snapshot.units.MobileUnit;
import it.unibz.inf.pp.clash.model.snapshot.units.Unit;
import it.unibz.inf.pp.clash.model.snapshot.units.impl.Wall;

import java.util.*;


public class NormalizedBoardImpl implements NormalizedBoard {

    private Board board;
    private Snapshot.Player player;
    private Stack<Unit>[] normalizedBoard;
    final private Set<Formation> formations = new HashSet<>();

    public static NormalizedBoard createNormalizedBoard(Board board, Snapshot.Player player) {
        var normalizedBoard = new NormalizedBoardImpl();
        normalizedBoard.board = board;
        normalizedBoard.player = player;
        normalizedBoard.initializeNormalizedBoard();
        return normalizedBoard;
    }

    @Override
    public int getMaxColumnIndex() {
        return board.getMaxColumnIndex();
    }

    @Override
    public int getMaxRowIndex() {
        return (board.getMaxRowIndex()) / 2;
    }

    @Override
    public boolean areValidCoordinates(int rowIndex, int columnIndex) {
        return rowIndex >= 0 && rowIndex <= getMaxRowIndex() && columnIndex >= 0 && columnIndex <= getMaxColumnIndex();
    }

    @Override
    public Optional<Unit> getUnit(int rowIndex, int columnIndex) {
        try {
            checkBoundaries(rowIndex, columnIndex);
        } catch (CoordinatesOutOfBoardException ex) {
            return Optional.empty();
        }
        if (rowIndex >= normalizedBoard[columnIndex].size() || rowIndex < 0) return Optional.empty();
        return Optional.ofNullable(normalizedBoard[columnIndex].get(rowIndex));
    }

    @Override
    public Optional<Unit> getUnit(int columnIndex) {
        return getUnit(Math.max(normalizedBoard[columnIndex].size() - 1, 0), columnIndex);
    }

    @Override
    public boolean isUnitInFormation(Unit unit) {
        return formations.stream().anyMatch(formation ->
                formation.getUnits().contains(unit));
    }

    @Override
    public Snapshot.Player getPlayer() {
        return player;
    }

    @Override
    public boolean canPlaceInColumn(int columnIndex) {
        var stack = normalizedBoard[columnIndex];
        return stack.size() <= getMaxRowIndex();
    }

    @Override
    public boolean isFull() {
        return getAvailableSpots() == 0;
    }


    @Override
    public int getAvailableSpots() {
        return Arrays.stream(normalizedBoard).mapToInt(stack -> (getMaxRowIndex() + 1) - stack.size()).sum();
    }


    @Override
    public void addUnit(int rowIndex, int columnIndex, Unit unit) {
        var stack = normalizedBoard[columnIndex];
        stack.add(rowIndex, unit);
        checkBoundaries(rowIndex, columnIndex);
        applyFormations(checkForFormations());
        checkAndApplyDefensiveFormation(player);
        applyBoardState();
    }

    @Override
    public void addUnit(int columnIndex, Unit unit) {
        var stack = normalizedBoard[columnIndex];
        var stackTop = stack.size() - 1;
        addUnit(stackTop + 1, columnIndex, unit);
    }

    @Override
    public void removeUnit(int rowIndex, int columnIndex) {
        checkBoundaries(rowIndex, columnIndex);
        board.removeUnit(getRealRowIndex(rowIndex), columnIndex);
        var stack = normalizedBoard[columnIndex];
        stack.remove(rowIndex);
        formations.forEach(formation -> {
            // Note: this should really only happen if the unit was a wall.
            if (formation.getRowIndex() > rowIndex) {
                formation.setRowIndex(formation.getRowIndex() - 1);
            }
        });
        applyFormations(checkForFormations());
        checkAndApplyDefensiveFormation(player);
        applyBoardState();

    }


    @Override
    public void removeUnit(int columnIndex) {
        var stack = normalizedBoard[columnIndex];
        var stackTop = stack.size() - 1;
        if (stackTop >= 0) {
            removeUnit(stackTop, columnIndex);
        }
    }

    @Override
    public int normalizeRowIndex(int rowIndex) {
        var middle = (board.getMaxRowIndex() + 1) / 2;
        if (player == Snapshot.Player.FIRST) {
            // map 6->0 7->1 .. 11->5
            return rowIndex - middle;
        } else {
            // map 5->0 4->1 .. 0->5
            return middle - rowIndex - 1;
        }
    }

    @Override
    public int getRealRowIndex(int normalizedRowIndex) {
        var middle = (board.getMaxRowIndex() + 1) / 2;
        if (player == Snapshot.Player.FIRST) {
            return normalizedRowIndex + middle;
        } else {
            return Math.abs(normalizedRowIndex - middle + 1);
        }
    }

    @Override
    public Stack<Unit>[] getNormalizedBoard() {
        return normalizedBoard;
    }

    private void initializeNormalizedBoard() {

        Stack<Unit>[] stacks = new Stack[getMaxColumnIndex() + 1];

        for (int i = 0; i < stacks.length; i++) {
            var stack = new Stack<Unit>();
            stacks[i] = stack;

            for (int j = 0; j < getMaxRowIndex(); j++) {
                var unit = board.getUnit(getRealRowIndex(j), i);
                unit.ifPresent(stack::push);
            }
        }
        normalizedBoard = stacks;
    }


    private void checkBoundaries(int rowIndex, int columnIndex) {
        if (!areValidCoordinates(rowIndex, columnIndex)) {
            throw new CoordinatesOutOfBoardException(rowIndex, columnIndex, getMaxRowIndex(), getMaxColumnIndex());
        }
    }

    private void removeFormation(Formation formation) {

        //counting for reinforcement
        for (Unit unit : formation.getUnits()) {
            countAsRemoved(player, unit);
        }

        formations.remove(formation);
        normalizedBoard[formation.getColumnIndex()].removeAll(formation.getUnits());

    }

    private void applyFormations(List<Formation> newFormations) {
        if (newFormations.isEmpty()) return;
        for (var newFormation : newFormations) {

            var formationsInColumn = formations.stream().filter(f -> f.getColumnIndex() == newFormation.getColumnIndex());
            int maxRowIndex = formationsInColumn.map(formation -> formation.getRowIndex() + 3).max(Integer::compareTo).orElse(0);
            var stack = normalizedBoard[newFormation.getColumnIndex()];
            stack.removeAll(newFormation.getUnits());

            // here: attacking formations will not replace walls anymore
            int insertIndex = 0;

            for (int i = 0; i < stack.size(); i++) {
                Unit unit = stack.get(i);
                if (unit instanceof Wall) {
                    insertIndex = i + 1;
                } else if (unit instanceof MobileUnit) {

                    break;

                } else {
                    insertIndex = i;
                }
            }

            // moving units toColumn make space (not the walls)
            List<Unit> toShift = new ArrayList<>();
            for (int i = insertIndex; i < stack.size(); i++) {
                Unit u = stack.get(i);
                if (u instanceof MobileUnit) {
                    toShift.add(u);
                } else {
                    break;
                }
            }

            // removing the units (only the mobile ones)
            for (Unit u : toShift) {
                stack.remove(u);
            }

            // putting the formation
            for (int i = 0; i < newFormation.getUnits().size(); i++) {
                int idx = insertIndex + i;
                if (idx < stack.size()) {
                    stack.set(idx, newFormation.getUnits().get(i));
                } else {
                    stack.add(newFormation.getUnits().get(i));
                }
            }

            // only adding if not on a wall
            for (int i = 0; i < toShift.size(); i++) {
                int index = insertIndex + newFormation.getUnits().size() + i;

                if (index >= stack.size()) {
                    stack.add(toShift.get(i));
                } else {
                    Unit u = stack.get(index);

                    if (u == null || u instanceof MobileUnit) {
                        stack.set(index, toShift.get(i));
                    } else {

                        System.out.println("Not moving walls. " + newFormation.getColumnIndex());
                    }
                }
            }

            formations.add(new Formation(maxRowIndex, newFormation.getColumnIndex(), newFormation.getUnits(), newFormation.isAttackingFormation()));
        }
    }

    public int takeDamage(int damage, int column) {
        var stack = normalizedBoard[column];
        if (stack.isEmpty()) return damage;
        var formationsInStack = formations.stream().filter(f -> f.getColumnIndex() == column).toList();
        var unit = stack.firstElement();
        while (damage > 0 && !stack.isEmpty()) {
            var firstRowFormationMaybe = formationsInStack.stream().filter(f -> f.getRowIndex() == 0).findFirst();

            if (firstRowFormationMaybe.isPresent()) {
                var firstRowFormation = firstRowFormationMaybe.get();
                // NOTE: in Might&Magic, when a formation is formed, its attack behaves like its health.
                // So when a formation is attacked, its attack will deal less damage.
                var formationDamage = firstRowFormation.getFormationAttackDamage();
                if (formationDamage <= damage) {
                    damage -= formationDamage;
                    removeFormation(firstRowFormation);
                } else {
                    firstRowFormation.setFormationAttackDamage(formationDamage - damage);
                    damage = 0;
                }


            } else if (unit.getHealth() <= damage) {
                damage -= unit.getHealth();
                // TODO: Check if the unit was in a formation
                removeUnit(0, column);
                countAsRemoved(player, unit);
            } else {
                unit.setHealth(unit.getHealth() - damage);
                damage = 0;
            }
            if (!stack.isEmpty()) {
                unit = stack.firstElement();
            }
        }
        applyBoardState();
        return damage;

    }

    public void updateFormations(Hero enemyHero, NormalizedBoard enemyBoard) {
        var formationsToRemove = new ArrayList<Formation>();
        for (var formation : formations) {
            formation.update();

            if (formation.shouldBeDestroyed()) {
                formationsToRemove.add(formation);
                if (formation.isAttackingFormation()) {
                    var formationDamage = formation.getFormationAttackDamage();
                    var heroDamage = enemyBoard.takeDamage(formationDamage, formation.getColumnIndex());
                    enemyHero.setHealth(enemyHero.getHealth() - heroDamage);
                    applyBoardState();
                }
            }
        }
        if (formationsToRemove.isEmpty()) return;

        formationsToRemove.forEach(this::removeFormation);
        var newAttack = checkForFormations();
        applyFormations(newAttack);

        applyBoardState();
    }

    // Checks the board for conditions and appends them to the formations list
    private List<Formation> checkForFormations() {

        var newFormations = new ArrayList<Formation>();
        for (int i = 0; i < normalizedBoard.length; i++) {
            var stack = normalizedBoard[i];
            // Check for attacking formations
            if (stack.size() >= 3) {
                // sliding window, finding 3 consecutive mobile units
                for (int j = 0; j <= stack.size() - 3; j++) {

                    int finalI = i;
                    int finalJ = j;

                    // this formation is already present. Skip it.
                    if (formations.stream().anyMatch(f -> f.getColumnIndex() == finalI && f.getRowIndex() <= finalJ && finalJ < f.getRowIndex() + 3)) {
                        continue;
                    }

                    Unit u1 = stack.get(j);
                    Unit u2 = stack.get(j + 1);
                    Unit u3 = stack.get(j + 2);

                    if (u1 instanceof MobileUnit m1 && u2 instanceof MobileUnit m2 && u3 instanceof MobileUnit m3) {
                        if (m1.matches(m2) && m1.matches(m3)) {
                            // we have an attack formation vertically
                            List<Unit> formation = new ArrayList<>(Arrays.asList(m1, m2, m3));
                            newFormations.add(new Formation(j, i, formation, true));

                        }
                    }
                }
            }
        }

        return newFormations;
    }


    public void checkAndApplyDefensiveFormation(Snapshot.Player currentPlayer) {
        int maxRow = getMaxRowIndex();
        int maxCol = getMaxColumnIndex();

        for (int row = 0; row <= maxRow; row++) {
            MobileUnit previousMobile = null;
            int count = 0;
            List<Unit> chain = new ArrayList<>();
            int startCol = 0;

            for (int col = 0; col <= maxCol; col++) {
                var unitOpt = getUnit(row, col);
                if (unitOpt.isPresent() && unitOpt.get() instanceof MobileUnit currentMobile) {
                    if (previousMobile != null && previousMobile.matches(currentMobile)) {
                        chain.add(currentMobile);
                        count++;
                    } else {
                        if (count >= 3) {
                            applyWallChainCentered(chain, startCol, currentPlayer);
                        }
                        previousMobile = currentMobile;
                        chain.clear();
                        chain.add(currentMobile);
                        count = 1;
                        startCol = col;
                    }
                } else {
                    if (count >= 3) {
                        applyWallChainCentered(chain, startCol, currentPlayer);
                    }
                    previousMobile = null;
                    chain.clear();
                    count = 0;
                }
            }

            if (count >= 3) {
                applyWallChainCentered(chain, startCol, currentPlayer);
            }
        }
    }


    private void applyWallChainCentered(List<Unit> units, int startCol, Snapshot.Player currentPlayer) {
        int length = units.size();
        int centerCol = startCol + (length / 2);
        int firstCol = centerCol - (length / 2);

        // removing units
        for (var unit : units) {
            for (var stack : normalizedBoard) {
                if (stack.remove(unit)) {
                    countAsRemoved(player, unit);
                    break;
                }
            }
        }

        int preferredRow = (currentPlayer == Snapshot.Player.FIRST) ? 6 : 5;
        int normalizedPreferred = normalizeRowIndex(preferredRow);

        for (int i = 0; i < length; i++) {
            int col = firstCol + i;
            if (col < 0 || col >= normalizedBoard.length) continue;

            Stack<Unit> stack = normalizedBoard[col];

            // first row without a wall
            int targetIndex = normalizedPreferred;
            while (targetIndex < getMaxRowIndex() + 1 && targetIndex < stack.size() && stack.get(targetIndex) instanceof Wall) {
                targetIndex++;
            }

            while (stack.size() <= targetIndex) {
                stack.add(null);
            }

            // shift if necessary
            boolean hasShiftableUnits = false;
            for (int j = targetIndex; j < stack.size(); j++) {
                Unit u = stack.get(j);
                if (u instanceof MobileUnit) {
                    hasShiftableUnits = true;
                    break;
                }
            }

            if (hasShiftableUnits) {
                for (int j = stack.size() - 1; j >= targetIndex; j--) {
                    if (j + 1 >= stack.size()) {
                        stack.add(stack.get(j));
                    } else {
                        stack.set(j + 1, stack.get(j));
                    }
                }
            }

            stack.set(targetIndex, new Wall());
        }

        System.out.println("Placed a new wall chain.");
    }

    // Applies the normalized board state toColumn the actual board. Making sure they're always in sync.
    void applyBoardState() {
        // Completely reset this player's side of the board
        for (int i = 0; i <= getMaxColumnIndex(); i++) {
            for (int j = 0; j <= getMaxRowIndex(); j++) {
                var row = getRealRowIndex(j);
                var col = i;
                board.getUnit(row, col).ifPresent(u -> board.removeUnit(row, col));
            }
        }

        for (int i = 0; i <= getMaxColumnIndex(); i++) {
            var stack = normalizedBoard[i];
            for (int j = 0; j < stack.size(); j++) {
                var row = getRealRowIndex(j);
                board.addUnit(row, i, stack.get(j));
            }
        }

    }

    //counting removed units - for call reinforcement
    private static final Map<Snapshot.Player, Integer> removedUnitsCount = new EnumMap<>(Snapshot.Player.class);

    public static void countAsRemoved(Snapshot.Player player, Unit unit) {
        if (unit instanceof MobileUnit) {
            removedUnitsCount.merge(player, 1, Integer::sum);
        }
    }

    public static void initRemovedUnitsCount() {
        removedUnitsCount.put(Snapshot.Player.FIRST, 3);
        removedUnitsCount.put(Snapshot.Player.SECOND, 3);
    }


    public static int getRemovedUnitsCount(Snapshot.Player player) {
        return removedUnitsCount.get(player);
    }

    public static void resetRemovedUnitsCount(Snapshot.Player player) {
        removedUnitsCount.put(player, 0);
    }




}
