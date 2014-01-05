/*
 * Options:
 * - container: l'id de la div où dessiner le puzzle
 * - size: (width,height) la taille de puzzle désirée
 * - piecesNumber: (x,y) le nombre de pièces désirées
 */
var Puzzle = function(options) {
    var listeners = $.Callbacks();
    var size = options.size;
    var piecesNumber = options.piecesNumber;
    var stage = new Kinetic.Stage({
        container: options.container,
        width: size.width,
        height: size.height
    });
    var piecesLayer = new Kinetic.Layer();
    // les pièces du puzzle
    var pieces = []; 
    // les groupes de pièces (correctement placées)
    var groups = []; 
    // la distance en px à laquelle deux pièces
    // correctement placées sont automatiquement alignées
    var snapDistance = options.snapDistance;

    var done = false; // true quand le puzzle est terminé

    /*
     * Calcule une position aléatoire sur le puzzle,
     * en respectant les marges données en paramètre.
     */
    var getRandomPos = function(marginWidth,marginHeight) {
        return {
            x: Math.floor(Math.random()*(size.width-marginWidth)),
            y: Math.floor(Math.random()*(size.height-marginHeight))
        };
    };

    /*
     * Contrôle si deux pièces sont voisines (vertical ou horizontal)
     */
    var areNeighbors = function(piece1, piece2) {
        var p1 = piece1.puzzle;
        var p2 = piece2.puzzle;
        // même colonne, l'une sur l'autre
        if ((p1.col === p2.col) && (Math.abs(p1.row-p2.row) === 1))
            return true;
        // même ligne, côtes-à-côtes
        else if ((p1.row === p2.row) && (Math.abs(p1.col-p2.col) === 1))
            return true;
        else return false;
    };

    /*
     * Calcule la position relative de deux pièces (position actuelle).
     */
    var getPiecesRelativePos = function(p1,p2) {
        var pos1 = p1.getAbsolutePosition();
        var pos2 = p2.getAbsolutePosition();
        return {
            x: pos2.x - pos1.x,
            y: pos2.y - pos1.y
        };
    };

    /*
     * Calcule la position relative de deux pièces lorsqu'elles
     * sont placées correctement sur le puzzle.
     */
    var getCorrectPosOffset = function(piece,target) {
        var relPos = getPiecesRelativePos(piece,target);
        var correctRelPos = {
            x: piece.getWidth() * (target.puzzle.col - piece.puzzle.col),
            y: piece.getHeight() * (target.puzzle.row - piece.puzzle.row)
        };
        return {
            x: relPos.x - correctRelPos.x,
            y: relPos.y - correctRelPos.y
        }
    };

    /*
     * Contrôle si l'offset donné est en plus petit que
     * le niveau d'alignement automatique.
     */
    var shouldSnap = function(offset) {
        return Math.max(Math.abs(offset.x),Math.abs(offset.y)) < snapDistance
    };

    /*
     * Aligne la pièce (piece) avec la cible donnée (target)
     * et les met dans le même groupe.
     */
    var snapAndMerge = function(piece,target,offset) {
        piece.getParent().move(offset.x,offset.y);
        var groupRelPos = {
            x: piece.getParent().getX() - target.getParent().getX(),
            y: piece.getParent().getY() - target.getParent().getY()
        };
        _.each(piece.getParent().getChildren().toArray(), function(p) {
            p.remove();
            p.move(groupRelPos.x,groupRelPos.y);
            target.getParent().add(p);
        });
    };

    /*
     * Contrôle si les deux pièces font partie du même groupe.
     * Retourne true si c'est le cas, false sinon.
     */
    var areInSameGroup = function(piece,other) {
        return piece.getParent().getId() === other.getParent().getId();
    };

    var removeEmptyGroups = function() {
        groups = _.reject(groups, function(group) {
            return _.size(group.getChildren().toArray()) === 0
        });
    };

    var checkDone = function() {
        if (!done) {
            if (_.size(groups) === 1) {
                listeners.fire();
                done = true;
            }
        }
        return done;
    };

    /*
     * Contrôle si la pièce passée en paramètre est proche
     * de sa position correcte par rapport aux autres pièces.
     * Fonction à appeler lorsqu'une pièce a été bougée.
     */
    var checkPiece = function(piece) {
        _.each(pieces, function(other) {
            if (!areInSameGroup(piece,other) &&
                areNeighbors(piece,other)) {
                    var offset = getCorrectPosOffset(piece,other);
                    if (shouldSnap(offset)) {
                        snapAndMerge(piece,other,offset);
                        piecesLayer.draw();
                    }
                }
        });
        removeEmptyGroups();
        checkDone();
    };

    /*
     * Ajoute une pièce au puzzle, en extrayant l'image
     * contenue dans le canvas passé en paramètre.
     * Le paramètre pieceProperties est simplement ajouté à la
     * pièce créée.
     * La pièce est ajoutée au layer piecesLayer.
     */
    var addPiece = function(canvas,pieceProperties) {
        var img = new Image();
        // position aléatoire
        var pos = getRandomPos(canvas.width,canvas.height);
        var loadImage = function() {
            // on créée la pièce (image)
            var piece = new Kinetic.Image({
                id:pieces.length,
                x:pos.x, y:pos.y, image:img,
                width:canvas.width, height:canvas.height
            });
            // on lui assigne les propriétés passées en paramètre
            piece.puzzle = pieceProperties;
            // chaque pièce est stockée dans un groupe, ce qui facilitera
            // leur groupement lorsque le puzzle sera construit
            var group = new Kinetic.Group({
                id:groups.length,
                draggable:true
            });
            group.on('mousedown', function() {
                // on déplace la pièce en dessus de toutes les autres
                group.moveToTop();
            });
            group.on('dragend', function() {
                // lorsqu'un groupe a été déplacé, on contrôle si
                // les pièces qu'il contient peuvent être accrochées à d'autres
                // (-> elles sont dans la bonne position)
                var children = group.getChildren().toArray();
                _.each(children, function(p) {
                    checkPiece(p);
                });
            });
            group.add(piece);
            piecesLayer.add(group);
            pieces.push(piece);
            groups.push(group);
        };
        // le contenu du canvas est utilisé comme source de l'image
        img.src = canvas.toDataURL();
        // on charge l'image
        loadImage();
    };

    /*
     * Découpe l'image passée en paramètre en autant de
     * colonnes (col) et lignes (rows) que souhaité.
     */
    var splitImage = function(canvas,cols,rows) {
        var cellSize = {
            width: canvas.width/cols,
            height: canvas.height/rows
        };
        var pieceCanvas = document.createElement('canvas');
        pieceCanvas.width = cellSize.width;
        pieceCanvas.height = cellSize.height;
        var ctx = canvas.getContext('2d');
        for (var c=0; c<cols; ++c) {
            for (var r=0; r<rows; ++r) {
                var data = ctx.getImageData(
                    c * cellSize.width,
                    r * cellSize.height,
                    cellSize.width,
                    cellSize.height
                );
                pieceCanvas.getContext('2d').putImageData(data,0,0);
                addPiece(pieceCanvas,{col:c,row:r});
            }
        }
    };

    (function() {
        // on créée un élément img, dans lequel on copie l'image
        // contenue dans la div #sideImage.
        // La fonction ci-dessous est automatiquement appelée lorsque 
        // l'image est chargée.
        var img = $('<img id="image">').load(function() {
            var imgRatio = this.height/this.width;
            // on crée un canvas, en adaptant la taille à l'image
            var canvas = document.createElement('canvas');
            canvas.width = size.width/2;
            // sans dépasser 80% de la hauteur désirée
            canvas.height = Math.min(canvas.width * imgRatio, size.height * 0.8);
            canvas.width = canvas.height / imgRatio;
            var ctx = canvas.getContext('2d');
            // on dessine l'image sur le canvas
            ctx.drawImage(this,0,0,canvas.width,canvas.height);
            // on découpe l'image en pièces
            splitImage(canvas,piecesNumber.x,piecesNumber.y);
            // on dessine les pièces
            stage.add(piecesLayer);
        }).attr('src',$('#sideImage').attr('src'));
    })();

    return {
        onDone: function(cb) {
            listeners.add(cb);
        }
    };
};

// aggrandit/réduit la miniature du puzzle (si
// elle est affichée - voir puzzleOptions)
$('#picture').on('click', function() {
    $(this).toggleClass('small large');
});

/*
 * Function appelée automatiquement quand la page est chargée.
 * Configure et initialise le puzzle.
 */
//$(document).ready(function() {
$(window).load(function () {
    if (puzzleOptions.showMiniature) {
        $('#picture').show();
    } else {
        $('#picture').hide();
    }

    var size = (function() {
        var win = $(window);
        var container = $('#'+puzzleOptions.container);
        var offset = container.offset();
        var border = puzzleOptions.borderSize;
        return {
            width: container.width(),
            height: win.height() - 2*offset.top - border
        };
    })();

    var options = {
        size: size,
        container: puzzleOptions.container,
        piecesNumber: puzzleOptions.pieces,
        snapDistance: puzzleOptions.snapDistance
    };

    var puzzle = Puzzle(options);
    puzzle.onDone(function() {
        $('.bravo').trigger('play');
    });

});
