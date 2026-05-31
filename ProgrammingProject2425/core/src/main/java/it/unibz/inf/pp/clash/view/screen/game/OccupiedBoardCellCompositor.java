package it.unibz.inf.pp.clash.view.screen.game;

import it.unibz.inf.pp.clash.model.EventHandler;
import it.unibz.inf.pp.clash.model.snapshot.units.Unit;
import it.unibz.inf.pp.clash.view.screen.sync.AnimationCounter;
import it.unibz.inf.pp.clash.view.singletons.Dimensions;

import com.badlogic.gdx.scenes.scene2d.ui.Table;

import static it.unibz.inf.pp.clash.view.singletons.ColorManager.GuiColor.EMPTY_CELL;
import static it.unibz.inf.pp.clash.view.singletons.ColorManager.GuiColor.UNIT_BOUNDARY;


public class OccupiedBoardCellCompositor extends BoarCellCompositor {

    private final OccupiedBoardCellCenterCompositor cellCenterCompositor;

    private final int unitBoundaryThickness = Dimensions.instance().getUnitBoundaryThickness();

    public OccupiedBoardCellCompositor(EventHandler eventHandler, boolean debug, AnimationCounter animationCounter) {
        super(eventHandler, debug, animationCounter);
        cellCenterCompositor = new OccupiedBoardCellCenterCompositor(eventHandler, debug, animationCounter);
    }

    /**
     * Draws a 5x5 table.
     * The center cell is itself a table (instance of the class OccupiedBoardCellCenter) which displays all information about the unit.
     * <p>
     * The 16 outermost cells are tile borders.
     * The 8 remaining cells are unit boundaries.
     * <p>
     * The unit boundary cells may be colored, according to the values of {@code isUpperBoundary},
     * {@code isRightBoundary}, {@code isLowerBoundary} and  {@code isRightBoundary}.
     * <p>
     * Some of the tile border cells may be colored as well, in the case of a multi-tile unit, so that the unit border does not get interrupted.
     */
    public Table drawCell(
            int rowIndex,
            int columnIndex,
            Unit previousUnit,
            Unit newUnit,
            boolean isUpperBoundary,
            boolean isRightBoundary,
            boolean isLowerBoundary,
            boolean isLeftBoundary,
            boolean isSelectedTile
    ) {
        Table cell = new Table();
        cell.setDebug(debug);

        addOuterRow(cell, isUpperBoundary, isLeftBoundary, isRightBoundary);
        cell.row();
        addIntermediateRow(cell, isUpperBoundary, isLeftBoundary, isRightBoundary);
        cell.row();
        addMiddleRow(cell, rowIndex, columnIndex, previousUnit, newUnit, isLeftBoundary, isRightBoundary, isSelectedTile);
        cell.row();
        addIntermediateRow(cell, isLowerBoundary, isLeftBoundary, isRightBoundary);
        cell.row();
        addOuterRow(cell, isLowerBoundary, isLeftBoundary, isRightBoundary);
        return cell;
    }

    private void addOuterRow(Table cell, boolean isHorizontalBoundary, boolean isLeftBoundary, boolean isRightBoundary) {
        // left corner of tile border
        drawTileBorderCorner(cell);
        // same width as unit boundary corner, may be colored
        drawVerticalJunction(cell, isLeftBoundary && !isHorizontalBoundary);
        // tile border, no width specified (should fill in all available space)
        drawTileBorderHorizontalLine(cell);
        // same width as unit boundary corner, may be colored
        drawVerticalJunction(cell, isRightBoundary && !isHorizontalBoundary);
        // right corner of tile border
        drawTileBorderCorner(cell);
    }

    private void addIntermediateRow(Table cell, boolean isHorizontalBoundary, boolean isLeftBoundary, boolean isRightBoundary) {
        // same height as unit boundary corner, may be colored
        drawHorizontalJunction(cell, isHorizontalBoundary && !isLeftBoundary);
        // unit boundary corner
        drawUnitBoundaryCorner(cell, isHorizontalBoundary || isLeftBoundary);
        // unit boundary, no width specified (should fill in all available space)
        drawUnitBoundaryHorizontalLine(cell, isHorizontalBoundary);
        // unit boundary corner
        drawUnitBoundaryCorner(cell, isHorizontalBoundary || isRightBoundary);
        // same height as unit boundary corner, may be colored
        drawHorizontalJunction(cell, isHorizontalBoundary && !isRightBoundary);
    }

    private void addMiddleRow(Table cell, int rowIndex, int columnIndex, Unit previousUnit, Unit newUnit,
                              boolean isLeftBoundary, boolean isRightBoundary, boolean isSelectedTile) {
        // tile border, no height specified (should fill in all available space)
        drawTileBorderVerticalLine(cell);
        // unit boundary, no height specified (should fill in all available space)
        drawUnitBoundaryVerticalLine(cell, isLeftBoundary);
        // central cell, no height nor width specified (should fill in all available space)
        drawCenter(cell, rowIndex, columnIndex, previousUnit, newUnit, isSelectedTile);
        // unit boundary, no height specified (should fill in all available space)
        drawUnitBoundaryVerticalLine(cell, isRightBoundary);
        // tile border, no height specified (should fill in all available space)
        drawTileBorderVerticalLine(cell);
    }

    private void drawTileBorderCorner(Table cell) {
        drawCorner(
                cell,
                drawTileBorder(false),
                tileBorderThickness
        );
    }

    private void drawUnitBoundaryCorner(Table cell, boolean isColored) {
        drawCorner(
                cell,
                drawUnitBoundary(isColored),
                unitBoundaryThickness
        );
    }

    private void drawCorner(Table parentCell, Table childCell, int thickness) {
        parentCell.add(childCell)
                .width(thickness)
                .height(thickness);
    }

    private void drawVerticalJunction(Table cell, boolean isUnitBoundary) {
        drawJunction(cell, unitBoundaryThickness, tileBorderThickness, isUnitBoundary);
    }

    private void drawHorizontalJunction(Table cell, boolean isUnitBoundary) {
        drawJunction(cell, tileBorderThickness, unitBoundaryThickness, isUnitBoundary);
    }

    private void drawJunction(Table cell, int width, int height, boolean isUnitBoundary) {
        cell.add(drawTileBorder(isUnitBoundary))
                .width(width)
                .height(height);
    }

    private void drawTileBorderHorizontalLine(Table cell) {
        drawHorizontalLine(
                cell,
                drawTileBorder(false),
                tileBorderThickness
        );
    }

    private void drawUnitBoundaryHorizontalLine(Table cell, boolean isColored) {
        drawHorizontalLine(
                cell,
                drawUnitBoundary(isColored),
                unitBoundaryThickness
        );
    }

    private void drawHorizontalLine(Table parentCell, Table childCell, int height) {
        parentCell.add(childCell)
                .height(height)
                .expandX()
                .fill();
    }

    private void drawTileBorderVerticalLine(Table cell) {
        drawVerticalLine(
                cell,
                drawTileBorder(false),
                tileBorderThickness
        );
    }

    private void drawUnitBoundaryVerticalLine(Table cell, boolean isColored) {
        drawVerticalLine(
                cell,
                drawUnitBoundary(isColored),
                unitBoundaryThickness
        );
    }

    private void drawVerticalLine(Table parentCell, Table childCell, int width) {
        parentCell.add(childCell)
                .width(width)
                .expandY()
                .fill();
    }

    private void drawCenter(Table cell, int rowIndex, int columnIndex, Unit previousUnit, Unit newUnit,
                            boolean isSelectedTile) {
        cell.add(
                cellCenterCompositor.drawCellCenter(
                        rowIndex,
                        columnIndex,
                        previousUnit,
                        newUnit,
                        isSelectedTile
                ))
                .expand()
                .fill();
    }

    private Table drawUnitBoundary(boolean isUnitBoundary) {
        return drawTable(
                isUnitBoundary ?
                        UNIT_BOUNDARY :
                        EMPTY_CELL
        );
    }
}
