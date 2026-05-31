package it.unibz.inf.pp.clash.view.screen.home;

import com.badlogic.gdx.Game;
import com.badlogic.gdx.scenes.scene2d.ui.*;
import it.unibz.inf.pp.clash.controller.listeners.CloseApplicationListener;
import it.unibz.inf.pp.clash.controller.listeners.NewGameListener;
import it.unibz.inf.pp.clash.controller.listeners.ResolutionChangeListener;
import it.unibz.inf.pp.clash.model.EventHandler;
import it.unibz.inf.pp.clash.view.screen.Compositor;
import it.unibz.inf.pp.clash.view.singletons.Dimensions;
import it.unibz.inf.pp.clash.view.singletons.FileManager;
import it.unibz.inf.pp.clash.view.singletons.SkinManager;

import java.util.stream.Stream;

public class HomeScreenCompositor extends Compositor {
    public HomeScreenCompositor(EventHandler eventHandler, boolean debug) {
        super(eventHandler, debug);
    }

    public Table drawHomeScreen(Game game) {

        Table mainTable = createMainTable();

        Skin skin = SkinManager.instance().getDefaultSkin();

        SelectBox<String> firstHeroSelectBox = createHeroSelectBox(skin);
        SelectBox<String> secondHeroSelectBox = createHeroSelectBox(skin);

        addResolutionSelection(mainTable, skin);
        addLargeVerticalSpace(mainTable);
        addHeroSelection("First hero", mainTable, firstHeroSelectBox, skin);
        addSmallVerticalSpace(mainTable);
        addHeroSelection("Second hero ", mainTable, secondHeroSelectBox, skin);
        addLargeVerticalSpace(mainTable);
        addNewGameButton(mainTable, firstHeroSelectBox, secondHeroSelectBox, skin);
        addLargeVerticalSpace(mainTable);
        addExitButton(mainTable, game, skin);

        return mainTable;
    }

    private SelectBox<String> createResolutionSelectBox(Skin skin) {
        SelectBox<String> selectBox = createSelectBox(
                Stream.of(Dimensions.Resolution.values())
                        .map(r -> r.asString)
                        .toArray(String[]::new),
                skin
        );
        selectBox.addListener(new ResolutionChangeListener());
        selectBox.setSelected(Dimensions.instance().getActiveResolution().asString);
        return selectBox;
    }

    private SelectBox<String> createHeroSelectBox(Skin skin) {
        return createSelectBox(FileManager.instance().getHeroNames(), skin);
    }

    private SelectBox<String> createSelectBox(String[] items, Skin skin) {
        SelectBox<String> selectBox = new SelectBox<>(skin);
        selectBox.setItems(items);
        return selectBox;
    }

    private void addResolutionSelection(Table mainTable, Skin skin) {
        mainTable.add(new Label("Resolution", skin));
        mainTable.add(createResolutionSelectBox(skin))
                .fillX();
        mainTable.row();
    }

    private void addHeroSelection(String displayedText, Table mainTable, SelectBox<String> selectBox, Skin skin) {
        mainTable.add(new Label(displayedText, skin));
        mainTable.add(selectBox).fillX();
        mainTable.row();
    }

    private void addExitButton(Table mainTable, Game game, Skin skin) {
        TextButton exitButton = new TextButton("Close", skin);
        mainTable.add(exitButton).colspan(2).fillX().uniformX();
        exitButton.addListener(new CloseApplicationListener(game));
        mainTable.row();
    }

    private void addNewGameButton(Table mainTable, SelectBox<String> firstHeroSelectBox,
                                  SelectBox<String> secondHeroSelectBox, Skin skin) {

        TextButton newGameButton = new TextButton("New game", skin);
        newGameButton.addListener(new NewGameListener(firstHeroSelectBox, secondHeroSelectBox, eventHandler));
        mainTable.add(newGameButton).colspan(2).fillX().uniformX();
        mainTable.row();
    }

}
