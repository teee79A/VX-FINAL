package it.unibz.inf.pp.clash.controller.listeners;

import com.badlogic.gdx.scenes.scene2d.utils.ClickListener;
import it.unibz.inf.pp.clash.model.EventHandler;

public abstract class TileHoverListener extends ClickListener {

    // Mutable!
    static int previousHoverRowIndex = -1;
    // Mutable!
    static int previousHoverColumnIndex = -1;

    final int rowIndex;
    final int columnIndex;

    final EventHandler eventHandler;

    public TileHoverListener(int rowIndex, int columnIndex, int button, EventHandler eventHandler) {
        super(button);
        this.rowIndex = rowIndex;
        this.columnIndex = columnIndex;
        this.eventHandler = eventHandler;
    }

    protected boolean isHoveredOver() {
        // This condition is here for performance only.
        // The purpose is to avoid unnecessary calls to the method eventHandler.registerInformationRequest().
        if(previousHoverRowIndex != rowIndex || previousHoverColumnIndex != columnIndex){
            previousHoverRowIndex = rowIndex;
            previousHoverColumnIndex = columnIndex;
            return true;
        }
        return false;
    }
}
