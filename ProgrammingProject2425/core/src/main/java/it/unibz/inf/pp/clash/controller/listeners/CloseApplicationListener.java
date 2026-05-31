package it.unibz.inf.pp.clash.controller.listeners;

import com.badlogic.gdx.Game;
import com.badlogic.gdx.scenes.scene2d.InputEvent;
import com.badlogic.gdx.scenes.scene2d.utils.ClickListener;

public class CloseApplicationListener extends ClickListener {

    private final Game game;

    public CloseApplicationListener(Game game) {
        this.game = game;
    }

    @Override
    public void clicked(InputEvent event, float x, float y) {
        System.out.print( "Closing application...");
        game.dispose();
        System.exit(0);
    }
}
