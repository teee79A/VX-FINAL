package it.unibz.inf.pp.clash.view.screen.game;

import com.badlogic.gdx.scenes.scene2d.ui.ImageButton;
import com.badlogic.gdx.scenes.scene2d.ui.Table;
import it.unibz.inf.pp.clash.controller.listeners.EmptyTileHoverAndLeftClickListener;
import it.unibz.inf.pp.clash.model.EventHandler;
import it.unibz.inf.pp.clash.view.screen.sync.AnimationCounter;
import it.unibz.inf.pp.clash.view.singletons.ImageManager;

public class EmptyBoardCellCompositor extends BoarCellCompositor {


    public EmptyBoardCellCompositor(EventHandler eventHandler, boolean debug, AnimationCounter animationCounter) {
        super(eventHandler, debug, animationCounter);
    }

    Table drawCell(int rowIndex, int columnIndex, boolean isSelectedTile) {

        Table cell = new Table();
        cell.setDebug(debug);
        addOuterRow(cell);
        cell.row();
        addMiddleRow(cell, rowIndex, columnIndex, isSelectedTile);
        cell.row();
        addOuterRow(cell);
        return cell;
    }

    private void addOuterRow(Table cell) {
        // corner of tile border
        cell.add(drawTileBorder(false))
                .width(tileBorderThickness)
                .height(tileBorderThickness);
        // tile border, no width specified (should fill in all available space)
        cell.add(drawTileBorder(false))
                .height(tileBorderThickness)
                .expandX()
                .fill();
        // corner of tile border
        cell.add(drawTileBorder(false))
                .width(tileBorderThickness)
                .height(tileBorderThickness);
    }

    private void addMiddleRow(Table cell, int rowIndex, int columnIndex, boolean isSelectedTile) {

        // tile border, no height specified (should fill in all available space)
        cell.add(drawTileBorder(false))
                .width(tileBorderThickness)
                .expandY()
                .fill();

        // central cell, no height nor width specified (should fill in all available space)
        cell.add(createCentralCell(rowIndex, columnIndex, isSelectedTile))
                .expand()
                .fill();

        // tile border, no height specified (should fill in all available space)
        cell.add(drawTileBorder(false))
                .width(tileBorderThickness)
                .expandY()
                .fill();
    }

    private ImageButton createCentralCell(int rowIndex, int columnIndex, boolean isSelectedTile) {
        ImageButton button = ImageManager.instance().getEmptyCellButton(isSelectedTile);
        button.addListener(
                new EmptyTileHoverAndLeftClickListener(
                        rowIndex,
                        columnIndex,
                        eventHandler
                ));
        return button;
    }
}
