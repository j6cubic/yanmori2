"use strict";

var $stage;
var $info;
var $text;

var downloadURL = null;
var blockNames =
{
	0:   "Remove blocks",
	144: "Invisible wall",
	210: "Engine space",
	732: "Front hull",
	733: "Starboard hull",
	734: "Aft hull",
	735: "Port hull"
};
var blocks = {};
var blocksByLocation = {};
var highestX;
var highestY;
var lastBlockID = 99999;
var currentLevel = 0;
var currentType = 144;

var drawStartOffset = null;
var drawEndOffset = null;

/**
 * Clears the stage and displays all blocks for the given level.
 * @param level The level to display
 */
function displayY2Data(level)
{
	$stage.html('');

	var highestX = 0;
	var highestY = 0;
	var blockCount = 0;

	var levelName = level ? "B2" : "B1";

	for (var index in blocks)
	{
		var block = blocks[index];

		if (block.level != level)
		{
			continue;
		}

		highestX = Math.max(block.x, highestX);
		highestY = Math.max(block.y, highestY);
		lastBlockID = Math.max(lastBlockID, block.id);

		++blockCount;

		enterStage(block);
	}

	// Let's add some empty space around the fuselage to make potential
	// scrolling look nicer and allow people to expand the fuselage.
	$stage.css("min-width", highestX + 5 + "em");
	$stage.css("min-height", highestY + 5 + "em");
	$(".levelDisplay").html(levelName);
	$(".blockCount").html(Object.keys(blocks).length + " total<br>" + blockCount + " on level " + levelName);
}

/**
 * Displays the given block on the stage.
 * @param block The block
 */
function enterStage(block)
{
	var $div = $('<div></div>')
	           .addClass('block')
	           .addClass('name-' + block.name)
	           .addClass('id-' + block.id)
	           .css('left', block.x + 'em')
	           .css('top', block.y + 'em')
	           .data('id', block.id)
	           .data('name', block.name)
	           .data('level', block.level)
	           .data('x', block.x)
	           .data('y', block.y);

	$stage.append($div);

	// Keep Firefox from making the block draggable, which would interfere
	// with the editor.
	$div.mousedown(function(event)
	{
		event.preventDefault();
	});

	$div.hover(function()
	{
		var $this = $(this);

		$(".blockID").html($this.data("id"));
		$(".blockType").html(blockNames[$this.data("name")]);
		$(".blockX").html($this.data("x"));
		$(".blockY").html($this.data("y"));
	},
	function()
	{
		$(".blockID").html("");
		$(".blockType").html("");
		$(".blockX").html("");
		$(".blockY").html("");
	});
}

/**
 * Removes the given block from the stage.
 * @param block The block
 */
function exitStage(block)
{
	$(".id-" + block.id).remove();
}

/**
 * Adds a block to the block list and displays it on the stage if appropriate.
 * @param x The block's X position
 * @param y The block's Y position
 * @param level The level on which the block is found
 * @param type The block's type
 */
function addBlock(x, y, level, type)
{
	var index = blockIndexAt(x, y, level);

	if (index != null)
	{
		var block = blocks[index];

		blocks[index].name = type;

		if (level == currentLevel)
		{
			exitStage(block);
			enterStage(block);
		}

		return;
	}

	var block =
	{
		id: ++lastBlockID,
		level: level,
		name: type,
		x: x,
		y: y
	};

	blocks[block.id] = block;

	// This will make it easier to determine whether a block exists at a
	// given location.
	if (typeof(blocksByLocation[level]) == "undefined")
	{
		blocksByLocation[level] = {};
	}

	if (typeof(blocksByLocation[level][x]) == "undefined")
	{
		blocksByLocation[level][x] = {};
	}

	blocksByLocation[level][x][y] = block.id;

	if (level == currentLevel)
	{
		enterStage(block);
	}
}

/**
 * Determines the ID of the block at the given coordinates.
 * @param x The block's X position
 * @param y The block's Y position
 * @param level The level on which the block is found
 * @return {Number} The block's ID or null if no block was found
 */
function blockIndexAt(x, y, level)
{
	if (typeof(blocksByLocation[level]) != "undefined" &&
		typeof(blocksByLocation[level][x]) != "undefined" &&
		typeof(blocksByLocation[level][x][y]) != "undefined")
	{
		return blocksByLocation[level][x][y];
	}

	return null;
}

/**
 * Removes the block at the given coordinates from the block list and the stage.
 * @param x The block's X position
 * @param y The block's Y position
 * @param level The level on which the block is found
 */
function removeBlock(x, y, level)
{
	var index = blockIndexAt(x, y, level);

	if (index != null)
	{
		var block = blocks[index];

		if (block.id == lastBlockID)
		{
			--lastBlockID;
		}

		delete blocks[index];
		delete blocksByLocation[level][x][y];

		exitStage(block);
	}
}

/**
 * Sets the line start used by drawEnd() and drawPreview() to the point
 * indicated by the mousedown event that triggered this function.
 * @param event A mousedown event
 */
function drawStart(event)
{
	drawStartOffset =
	{
		x: Math.floor((event.pageX - $stage.get(0).offsetLeft) / 16),
		y: Math.floor((event.pageY - $stage.get(0).offsetTop) / 16)
	};
}

/**
 * Draw a line of blocks from the line start to the point indicated by the
 * mouseup event that triggered this function.
 * @param event A mouseup event
 * @see drawStart() for where the line start comes from
 */
function drawEnd(event)
{
	var x = Math.floor((event.pageX - $stage.get(0).offsetLeft) / 16);
	var y = Math.floor((event.pageY - $stage.get(0).offsetTop) / 16);

	drawLine(drawStartOffset.x, drawStartOffset.y, x, y, false);

	drawStartOffset = null;
	drawEndOffset = null;
}

/**
 * Draw a line of "ghost" blocks from the line start to the point indicated by
 * the mousemove event that triggered this function.
 *
 * Ghost blocks are non-permanent blocks used to show where the line will be
 * drawn once the mouse button is released. They do not actually enter the block
 * list.
 * @param event A mousemove event
 * @see drawStart() for where the line start comes from
 */
function drawPreview(event)
{
	if (!drawStartOffset)
	{
		return;
	}

	var newDrawEndOffset =
	{
		x: Math.floor((event.pageX - $stage.get(0).offsetLeft) / 16),
		y: Math.floor((event.pageY - $stage.get(0).offsetTop) / 16)
	};

	if (!drawEndOffset ||
		newDrawEndOffset.x != drawEndOffset.x ||
		newDrawEndOffset.y != drawEndOffset.y)
	{
		drawEndOffset = newDrawEndOffset;

		drawLine(drawStartOffset.x, drawStartOffset.y,
		         drawEndOffset.x, drawEndOffset.y, true);
	}
}

/**
 * Draws or erases a block at the given position.
 * @param x The X position
 * @param y The Y position
 * @param ghost Whether to draw a "ghost" block instead of a real one.
 * @see drawPreview() for information on ghost blocks
 */
function drawStep(x, y, ghost)
{
	if (ghost)
	{
		var $div = $('<div></div>')
		           .addClass('block')
		           .addClass('ghost')
		           .css('left', x + 'em')
		           .css('top', y + 'em');

		// Keep Firefox from making the block draggable, which would interfere
		// with the editor.
		$div.mousedown(function(event)
		{
			event.preventDefault();
		});

		$stage.append($div);
	}
	else
	{
		if (currentType)
		{
			addBlock(x, y, currentLevel, currentType);
		}
		else
		{
			removeBlock(x, y, currentLevel);
		}
	}
}

/**
 * Uses Bresenham's line algorithm to draw a line of blocks between the start
 * and end coordinates.
 * @param x1 The starting X position
 * @param y1 The starting Y position
 * @param x2 The ending X position
 * @param y2 The ending Y position
 * @param ghost Whether to draw "ghost" blocks instead of real ones.
 * @see drawPreview() for information on ghost blocks
 */
function drawLine(x1, y1, x2, y2, ghost)
{
	// Remove all ghost blocks
	$(".ghost").remove();

	var diffX = Math.abs(x1 - x2);
	var diffY = Math.abs(y1 - y2);

	var signX = x1 < x2 ? 1 : -1;
	var signY = y1 < y2 ? 1 : -1;

	var error = diffX - diffY;

	while (true)
	{
		drawStep(x1, y1, ghost);

		if (x1 == x2 && y1 == y2)
		{
			break;
		}

		var error2 = 2 * error;

		if (error2 > -diffY)
		{
			error -= diffY;
			x1 += signX;
		}

		if (error2 < diffY)
		{
			error += diffX;
			y1 += signY;
		}
	}
}

/**
 * Turns SSC coordinates into editor coordinates.
 * (Actually it simultaneously determines the offset between two blocks but
 *  that's only of historic significance now.)
 * @param x1 The first block's X position
 * @param y1 The first block's Y position
 * @param x2 The second block's X position
 * @param y2 The second block's Y position
 * @returns An object with the X and Y offset or undefined if the conversion
 *          failed.
 */
function blockOffset(x1, y1, x2, y2)
{
	var xDiff = x1 - x2;
	var yDiff = y1 - y2;

	var xOffset = ( 13 * xDiff - 16 * yDiff) / 416;
	var yOffset = (-13 * xDiff - 16 * yDiff) / 416;

	if (xOffset % 1 || yOffset % 1)
	{
		return undefined;
	}

	return {x: xOffset, y: yOffset};
}

/**
 * Turns editor coordinates into SSC coordinates.
 * (Actually it simultaneously determines the offset between two blocks but
 *  that's only of historic significance now.)
 * @param x1 The first block's X position
 * @param y1 The first block's Y position
 * @param x2 The second block's X position
 * @param y2 The second block's Y position
 * @returns An object with the X and Y offset or undefined if the conversion
 *          failed.
 */
function pxOffset(x1, y1, x2, y2)
{
	var xDiff = x1 - x2;
	var yDiff = y1 - y2;

	var xOffset =  16 * xDiff - 16 * yDiff;
	var yOffset = -13 * xDiff - 13 * yDiff;

	if (xOffset % 1 || yOffset % 1)
	{
		return undefined;
	}

	return {x: xOffset, y: yOffset};
}

/**
 * Attempts to parse the given string as an SSC fuselage layout file.
 * @param dataString The string to be parsed
 */
function parseY2Data(dataString)
{
	var data = ini.decode(dataString);

	// Extremely thorough format checks
	if (typeof(data[0]) == "undefined" ||
		typeof(data[0].fuselage) == "undefined")
	{
		return null;
	}

	blocks = {};
	blocksByLocation = {};
	lastBlockID = 99999;

	for (var index in data)
	{
		if (index == 0 ||
			index == 3 ||
			index == 999999999)
		{
			continue;
		}

		var block = data[index];
		var offsets = blockOffset(0, 0, block.x, block.y);

		block.id = index;
		block.x = 20 - offsets.x;
		block.y = offsets.y - 50;

		blocks[block.id] = block;
		lastBlockID = Math.max(lastBlockID, block.id);

		// This will make it easier to determine whether a block exists at a
		// given location.
		if (typeof(blocksByLocation[block.level]) == "undefined")
		{
			blocksByLocation[block.level] = {};
		}

		if (typeof(blocksByLocation[block.level][block.x]) == "undefined")
		{
			blocksByLocation[block.level][block.x] = {};
		}

		blocksByLocation[block.level][block.x][block.y] = block.id;
	}

	displayY2Data(currentLevel);
}

/**
 * Converts the contents of the blocks variable into the SSC fuselage layout
 * file format.
 * @returns {String} The contents of the file
 */
function stringifyY2Data()
{
	// We hardcode this because there are no non-Yanmori 2 fuselages right now.
	var fusBlocks =
	{
		0: { fuselage: "Yanmori 2" },
		3: { decks: 2 }
	};

	var lowestID = Number.MAX_VALUE;
	var highestID = 0;

	for (var index in blocks)
	{
		var block = $.extend(true, {}, blocks[index]);
		var offsets = pxOffset(0, 0, 20 - block.x, block.y + 50);
		var id = block.id;

		block.x = offsets.x;
		block.y = offsets.y;

		lowestID = Math.min(lowestID, id);
		highestID = Math.max(highestID, id);

		delete block.id;

		fusBlocks[id] = block;
	}

	// Apparently block 999999999 contains the IDs of the lowest and highest
	// "fuckers". SSC seems to attempt to load the corresponding section for
	// each number between these two numbers. If the range is too narrow, not
	// all blocks are loaded. If it is too wide, loading performance may suffer.
	fusBlocks[999999999] =
	{
		first_fucker: lowestID,
		last_fucker: highestID
	};

	return ini.encode(fusBlocks);
}

/**
 * Requests a local file from the user and attempts to parse it as an SSC
 * fuselage layout file.
 */
function loadY2Data()
{
	var $file = $("<input type='file'>");

	$file.change(function()
	{
		var file = $file.get(0).files[0];

		var reader = new FileReader();

		reader.onload = function(event)
		{
			parseY2Data(event.target.result);
		}

		reader.readAsText(file);
	});

	$file.click();
}

/**
 * Converts the contents of the blocks variable into the SSC fuselage layout
 * file format and forces a download for the resulting file.
 */
function saveY2Data()
{
	var dataString = stringifyY2Data();

	// I couldn't get this to work. Then again I didn't try very hard.
	// Improvements are welcome.
	
	/*
	// Determine whether we can use a modern approach to forcing a download.
	if ("download" in document.createElement("a"))
	{
		// We can! Sweet!
		var dataBlob = new Blob([dataString], { type: "text/plain", endings: "native" });

		if (downloadURL)
		{
			window.URL.revokeObjectURL(downloadURL);
		}

		downloadURL = window.URL.createObjectURL(dataBlob);

		$("<a href='" + downloadURL + "' download='Yanmori 2.fus'></a>").click();
		return;
	}

	// We can't so let's just lob a data URI at the browser.
	*/
	var string = "data:application/octet-stream;charset=utf-8;base64," +
	             base64.encode(stringifyY2Data());
	
	location.href = string;
	return;
}

$(document).ready(function()
{
	$stage = $('.stage');
	$info = $('.info');
	$text = $('.text');

	$('.button.level').click(function()
	{
		currentLevel = $(this).data('level');
		displayY2Data(currentLevel);
	});

	$(".button.load").click(function()
	{
		loadY2Data();
	});

	$(".button.save").click(function()
	{
		saveY2Data();
	});

	$stage.mousedown(function(event)
	{
		drawStart(event);
	});

	$stage.mouseup(function(event)
	{
		drawEnd(event);
	});

	$stage.mousemove(function(event)
	{
		drawPreview(event);
	});

	$(".palette .block").hover(function()
	{
		$(".paletteBlockType").html(blockNames[$(this).data("type")]);
	},
	function()
	{
		$(".paletteBlockType").html(blockNames[currentType]);
	});

	$(".palette .block").click(function()
	{
		var $this = $(this);

		currentType = $this.data("type");

		$this.addClass("active").siblings().removeClass("active");
	});
	
	$(".paletteBlockType").html(blockNames[currentType]);
});
