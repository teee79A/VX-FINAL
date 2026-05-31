package it.unibz.inf.pp.clash.view.screen.home;

import com.badlogic.gdx.Game;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Screen;
import it.unibz.inf.pp.clash.model.EventHandler;
import it.unibz.inf.pp.clash.view.screen.AbstractScreen;

public class HomeScreen extends AbstractScreen implements Screen {

    public HomeScreen(Game game, EventHandler eventHandler, boolean debug) {
        super(debug);
        // disables automatic calls to the render() method (30-50-80 times per second)
        Gdx.graphics.setContinuousRendering(false);
        HomeScreenCompositor compositor = new HomeScreenCompositor(eventHandler, debug);
        stage.addActor(
                compositor.drawHomeScreen(game)
        );
    }
}
