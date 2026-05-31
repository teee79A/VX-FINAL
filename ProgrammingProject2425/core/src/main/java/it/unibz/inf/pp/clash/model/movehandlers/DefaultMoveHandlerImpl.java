package it.unibz.inf.pp.clash.model.movehandlers;

import it.unibz.inf.pp.clash.model.MoveHandler;
import it.unibz.inf.pp.clash.model.snapshot.NormalizedBoard;
import it.unibz.inf.pp.clash.model.snapshot.units.MobileUnit;

public class DefaultMoveHandlerImpl implements MoveHandler {

    int previousColumnIndex = -1;

    @Override
    public boolean handleMove(int rowIndex, int columnIndex, NormalizedBoard board) {
        if (previousColumnIndex == -1) {
            if (board.getUnit(board.normalizeRowIndex(rowIndex), columnIndex).isPresent()) {
                previousColumnIndex = columnIndex;
            }
        } else {
            var selectedUnit = board.getUnit(previousColumnIndex);
            rowIndex = board.normalizeRowIndex(rowIndex);

            if (selectedUnit.isPresent() && selectedUnit.get() instanceof MobileUnit selectedMobileUnit) {

                if (isMoveUnitMove(board, selectedMobileUnit, columnIndex, rowIndex)) {
                    moveTurn(board, selectedMobileUnit, columnIndex);
                } else {
                    System.out.printf("Invalid move from column %d to column %d", previousColumnIndex, columnIndex);
                    previousColumnIndex = -1;
                    return false;
                }
                System.out.printf("Moved unit from column %d to column %d", previousColumnIndex, columnIndex);
                previousColumnIndex = -1;

                return true;
            }

        }
        return false;
    }

    private void moveTurn(NormalizedBoard playerBoard, MobileUnit selectedUnit, int columnIndex) {
        playerBoard.removeUnit(previousColumnIndex);
        playerBoard.addUnit(columnIndex, selectedUnit);
    }

    private boolean isMoveUnitMove(NormalizedBoard playerBoard, MobileUnit selectedUnit, int columnIndex, int rowIndex) {
        if (columnIndex == previousColumnIndex) return false;
        return playerBoard.canPlaceInColumn(columnIndex);
    }

    @Override
    public void resetState() {
        previousColumnIndex = -1;
    }
}
