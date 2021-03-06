﻿//  Kings Guardians v0.33
var TIME_TO_REPAIR_ONE_HEALTH = 60;		// seconds
var TIME_TO_PRODUCE_GOLD = 60;			// seconds
var GOLD_PER_HUT_UPGRADE = 1;			// pieces
var STORAGE_PER_UPGRADE = 100;			// pieces
var TIME_TO_MINE = 10 					// seconds
 
var GOLD_REWARD = 100; 
var XP_REWARD = 100;

function currTimeSeconds()
{
	var now = new Date();
	return now.getTime() / 1000;
}

function getAllCharacters( playfabID )
{
	var characters = server.GetAllUsersCharacters({ PlayFabId: playfabID }).Characters;
	for (i = 0; i < characters.length; i++) 
	{ 
		var info = characters[i];
		var data = server.GetCharacterData({
							PlayFabId: playfabID,
							CharacterId: characters[i].CharacterId });
		var inventory = server.GetCharacterInventory({
							PlayFabId: playfabID,
							CharacterId: characters[i].CharacterId });	
		
		characters[i] = { Info: info, Data: data, Inventory: inventory };
	}	
	return characters;
}

function CheckBuildingValue(playerInventory, upgrade, amount)
{
	var basePrice = amount;
	var tier = Math.floor(upgrade / 10);
	var multiplier = ( upgrade - Math.floor(tier) * 10);
	if(multiplier <= 0)
		multiplier = 1;	
	var amount = amount * multiplier;
	
	// CHECK materials
	if( tier > 3 && playerInventory.VirtualCurrency["SL"] < amount)
		return "You don't have enough steel ("+amount+") to upgrade this building!";	
	if( tier > 2 && playerInventory.VirtualCurrency["IR"] < amount)
		return "You don't have enough iron ("+amount+") to upgrade this building!"; 			
	if( tier > 1 && playerInventory.VirtualCurrency["ST"] < amount)
		return "You don't have enough stone ("+amount+") to upgrade this building!"; 		
	if( tier >= 0 && playerInventory.VirtualCurrency["WO"] < amount)
		return "You don't have enough wood ("+amount+") to upgrade this building!"; 
	
	var goldCost = Math.ceil(basePrice * upgrade / 2);
	if(goldCost <= 0)
		goldCost = 1;	
	
	if(playerInventory.VirtualCurrency["GC"] < goldCost)
		return "You don't have enough gold ("+goldCost+") to upgrade this building!"; 
	
	return "";
}

function SubtractCurrencyForBuilding(upgrade, amount, balance)
{
	var basePrice = amount;
	var tier = parseFloat(upgrade / 10);
	var multiplier = ( upgrade - Math.floor(tier) * 10);
	if(multiplier <= 0)
		multiplier = 1;	
	var amount = amount * multiplier;
	
	if( tier > 3 )
		balance.SI = server.SubtractUserVirtualCurrency({ PlayFabId: currentPlayerId, VirtualCurrency: "SL", Amount: amount}).Balance;
	if( tier > 2 )
		balance.IR = server.SubtractUserVirtualCurrency({ PlayFabId: currentPlayerId, VirtualCurrency: "IR", Amount: amount}).Balance;
	if( tier > 1 )
		balance.ST = server.SubtractUserVirtualCurrency({ PlayFabId: currentPlayerId, VirtualCurrency: "ST", Amount: amount}).Balance;
	if( tier >= 0 )
		balance.WO = server.SubtractUserVirtualCurrency({ PlayFabId: currentPlayerId, VirtualCurrency: "WO", Amount: parseInt(amount)}).Balance;		
	
	var goldCost = Math.ceil(basePrice * upgrade / 2);
	if(goldCost <= 0)
		goldCost = 1;	
	
	balance.GC = server.SubtractUserVirtualCurrency({ PlayFabId: currentPlayerId, VirtualCurrency: "GC", Amount: goldCost}).Balance;		
	
	return balance;		
}

/*********************************************************************************
***************************** GETTING DATA FROM SERVER **************************
**********************************************************************************/


/* This function query all the catalogs given in the 'args.Catalogs' parameter. */
handlers.downloadCatalogs = function(args)	
{
	var message = "ServerLog - downloadCatalogs handler (72.)\n *********\n";
	
	var catalogs = args.Catalogs;
	message += "\n Catalog Versions array length: "+catalogs.length;
		
	var catalogData = [];
	
	for(i = 0; i < catalogs.length; i++)
	{
		message += "\n " + i +". - loading " + catalogs[i] + " catalog";
		catalogData[i] = server.GetCatalogItems({ CatalogVersion: catalogs[i] });
	}
	
	log.info(message);
	return {msg : message, Catalogs : catalogData, serverTime: currTimeSeconds()};
}

/* This method returns the data of the specified player. 
 *  UserInfo, UserStatistics, UserData, UserInventory
 *  and the Characters of the user with their CharacterData and CharacterInventory 
 */
handlers.getPlayerData = function(args)	
{
	var log = "ServerLog - getPlayerData handler (94.)\n *********\n";
	
	var playfabID = args.PlayfabID;
	if(playfabID == "")
		playfabID = currentPlayerId;
	
	log += "\n PlayfabID: "+playfabID;
	
	// USERINFO
	var userInfo = server.GetUserAccountInfo({ PlayFabId: playfabID }).UserInfo;
	
	// STATS
	var statistics = server.GetUserStatistics({ PlayFabId: playfabID }).UserStatistics;
	
	// DATA
	var data = server.GetUserData({ PlayFabId: playfabID });	
	
	// INVENTORY
	var inventory = server.GetUserInventory({ PlayFabId: playfabID });
	
	// CHARACTERS
	var characters = getAllCharacters(playfabID);

	return {msg : log, UserInfo: userInfo, Statistics: statistics, Data: data, Inventory: inventory, Characters: characters, serverTime: currTimeSeconds()};
}

/* This method returns the data of the specified player. */
handlers.getPlayersCharacters = function(args)	
{
	var playfabID = args.PlayfabID;
	var characters = getAllCharacters(playfabID);
	return {msg : log, Characters: characters, serverTime: currTimeSeconds()};
}

/* This function returns the player's sqad. Squad is the team of characters that are participe in the battle.
 * Returns these characters custom data and inventory too.
 * Parameter needed: 'PlayerID'.
 */
handlers.getPlayerSquad = function(args)
{
	var PlayerID = args.PlayerID;

	// Player data	
	var userData = server.GetUserData({ PlayFabId: PlayerID, Keys: ["Squad"] }).Data;
	var characterIDList = ((typeof userData.Squad != 'undefined') && (typeof userData.Squad.Value != 'undefined') && userData.Squad.Value != "") ? userData.Squad.Value.split('|') : "";
	
	// Load all the player character
	var characterList = server.GetAllUsersCharacters({ PlayFabId: PlayerID }).Characters;
	
	for (i = 0; i < characterList.length; i++) 
	{ 
		var needThisCharacter = false;
		for(j = 0; j < characterIDList.length; j++)
		{
			if(characterIDList[j] == characterList[i].CharacterId)
			{
				needThisCharacter = true;
				break;
			}
		}
		
		if(needThisCharacter)
		{		
			var info = characterList[i];
			var data = server.GetCharacterData({
								PlayFabId: PlayerID,
								CharacterId: info.CharacterId });
			var inventory = server.GetCharacterInventory({
								PlayFabId: PlayerID,
								CharacterId: info.CharacterId });	
			
			characterList[i] = { Info: info, Data: data, Inventory: inventory };		
		}
		else
			characterList.splice(i, 1);						
	}
	
	return { toons : characterList, serverTime: currTimeSeconds()	};
}

/* Downloads the selected player data */ 
handlers.getTargetPlayerData = function(args)
{
	var EnemyPlayerID = args.EnemyPlayerID;
	
	// query buildings
	var inventory = server.GetUserInventory({ PlayFabId: EnemyPlayerID, CatalogVersion: "Buildings"});
		
	return{ buildings: inventory.Inventory, currencies: inventory.VirtualCurrency, serverTime: currTimeSeconds() };
	
	
}



/*********************************************************************************
********************************** SIMPLE MANIPULATIONS **************************
**********************************************************************************/

/* Selling an item 
 * Two parameters needed: ItemID and the item's CatalogVersion.
 */
handlers.sellItem = function(args)
{
	var itemID = args.ItemID;
	var itemInstanceID = args.ItemInstanceID;
	var catalogVersion = args.CatalogVersion;
		
	// Get item from the catalog
	var catalog = server.GetCatalogItems({ CatalogVersion : catalogVersion}).Catalog;
	var item;
	for( i = 0; i < catalog.length; i++)
	{
		if(catalog[i].ItemId == itemID)
			item = catalog[i];
	}
	
	// adjust currency
	server.AddUserVirtualCurrency({
				PlayFabId: currentPlayerId,
				VirtualCurrency: "GC",
				Amount: item.VirtualCurrencyPrices.GC
	});
	
	// remove one stack
	server.ModifyItemUses({ PlayFabId: currentPlayerId, ItemInstanceId: itemInstanceID, UsesToAdd: -1 });
	
	// query the inventory
	var inventory = server.GetUserInventory({ PlayFabId: currentPlayerId });
	
	return {  Inventory : inventory.Inventory, Currency: inventory.VirtualCurrency, Error : "", serverTime: currTimeSeconds() };
}

/* Consume an item.
 * Three parameter needed: ItemID, item's CatalogVersion and the CharacterID
 */
handlers.consumeItem = function(args)
{
	var itemID = args.ItemID;
	var catalogVersion = args.CatalogVersion;
	var characterID = args.CharacterId;
	
	// Get this item from the inventory
	var inventory = server.GetCharacterInventory({
					PlayFabId: currentPlayerId,
					CharacterId: characterID,
					CatalogVersion: catalogVersion,
					});
	
	// Get item instance id
	for( i = 0; i < inventory.Inventory.length; i++)
	{
		if(inventory.Inventory[i].ItemId == itemID)
		{
			var itemInstanceID = inventory.Inventory[i].ItemInstanceId;
			// MoveItemToCharacterFromUser
			server.MoveItemToUserFromCharacter({ PlayFabId: currentPlayerId, CharacterId: characterID, ItemInstanceId: itemInstanceID });
			// Modify item uses
			server.ModifyItemUses({ PlayFabId: currentPlayerId, ItemInstanceId: itemInstanceID, UsesToAdd: -1 });	
			return { };
		}
	}	
	return { };
}

/* Equip or Unequip item
 * Parameters: CharacterID, ItemInstanceI
 */
handlers.equipItem = function(args)
{
	// Equip / unequip
	if(args.Equip == "true")
		server.MoveItemToCharacterFromUser({ PlayFabId: currentPlayerId, CharacterId: args.CharacterId, ItemInstanceId: args.ItemInstanceId });
	else
		server.MoveItemToUserFromCharacter({ PlayFabId: currentPlayerId, CharacterId: args.CharacterId, ItemInstanceId: args.ItemInstanceId, });
	
	// Return inventoty & character inventory	
	return { ItemID : args.ItemID,
			 CharacterId : args.CharacterId,
			 ItemInstanceId : args.ItemInstanceId,
			 Equip : (args.Equip == "true"),
			 serverTime: currTimeSeconds()
			 };
}

/* Update character stats
 */
handlers.updateCharacterData = function(args)
{
	server.UpdateCharacterData({
		PlayFabId: currentPlayerId,
		CharacterId: args.CharacterId,
		Data: args.CharacterStatistics,
		Permission: "Public"
	});	
	
	return {  };
}

/* Buying a character and granting it to the user */
handlers.buyCharacter = function(args)
{
	var items = [args.ItemID];		
	var inventory = server.GetUserInventory({ PlayFabId: currentPlayerId, CatalogVersion: "Characters"}).Inventory;	
	
	var hasCharacterItem = false;
	for(i = 0; i<inventory.length; i++)
	{
		if(inventory[i].ItemID == args.ItemID)
			ok = true;
	}
	
	if(hasCharacterItem == false)
	{
		// Purchase character
		server.GrantItemsToUser({
						CatalogVersion: "Characters",
						PlayFabId: currentPlayerId,
						ItemIds: items,
						Annotation: "Character purchased.",
						});
	}		
	
	var characters = server.GetAllUsersCharacters( {  PlayFabId: currentPlayerId } ).Characters;
	var characterGranted = false;
	for(i = 0; i<characters.length; i++)
	{
		if(characters[i].CharacterType == args.ItemID)
			characterGranted = true;
	}
	
	if(characterGranted == false)
	{
		// Grant character to user
		server.GrantCharacterToUser({
							PlayFabId: currentPlayerId,
							CharacterName: args.ItemID,
							CharacterType: args.ItemID,
						});
	}
		
	return {};
}



/*********************************************************************************
********************************** CRAFTING FUNCTIONS *****************************
**********************************************************************************/

handlers.CheckProgress = function ( args )
{
	var log = "ServerLog - CheckProgress handler (347.)\n *********\n";
	var userData = server.GetUserData({ PlayFabId: currentPlayerId, Keys: ["Construct", "Mine", "Craft", "Repair", "GoldGeneration", "GoldStorage", "LastGoldTime", "Wins", "Loses"]}).Data;  // ADD more!
	var needUpdate = false;		
		
	var playerInventory = server.GetUserInventory({ PlayFabId: currentPlayerId, CatalogVersion: "Buildings" });	
	balance = playerInventory.VirtualCurrency;			
		
		
	/****************************** GOLD GENERATION ******************************/		
	var goldGeneration = ((typeof userData.GoldGeneration != 'undefined') && (typeof userData.GoldGeneration.Value != 'undefined') && userData.GoldGeneration.Value != "") ? userData.GoldGeneration.Value.split('|') : [];
	var goldStorage = ((typeof userData.GoldStorage != 'undefined') && (typeof userData.GoldStorage.Value != 'undefined') && userData.GoldStorage.Value != "") ? userData.GoldStorage.Value.split('|') : [];
	var lastGoldTime = ((typeof userData.LastGoldTime != 'undefined') && (typeof userData.LastGoldTime.Value != 'undefined') && userData.LastGoldTime.Value != "") ? parseFloat(userData.LastGoldTime.Value) : currTimeSeconds() - TIME_TO_PRODUCE_GOLD;
	
	var wins = ((typeof userData.Wins != 'undefined') && (typeof userData.Wins.Value != 'undefined') && userData.Wins.Value != "") ? parseInt(userData.Wins.Value) : 0;
	var loses = ((typeof userData.Loses != 'undefined') && (typeof userData.Loses.Value != 'undefined') && userData.Loses.Value != "") ? parseInt(userData.Loses.Value) : 0;
	var ratio = wins / (loses+wins);
	
	
	if( lastGoldTime + TIME_TO_PRODUCE_GOLD <= currTimeSeconds())
	{
		var amount = 0;
		for( cnt = 0; cnt < goldGeneration.length; cnt++)
		{
			var data = goldGeneration[cnt].split(':');
			amount += (1+parseInt(data[1])) * GOLD_PER_HUT_UPGRADE;
		}
		
		var storage = 0;
		for( cnt = 0; cnt < goldStorage.length; cnt++)
		{
			var data = goldStorage[cnt].split(':');
			storage += (1+parseInt(data[1])) * STORAGE_PER_UPGRADE;
		}		
		amount = storage - balance.GC;
		
		amount = Math.floor(ratio * amount);
		
		if( amount > 0)
		{
			balance.GC = server.AddUserVirtualCurrency({ PlayFabId: currentPlayerId, VirtualCurrency: "GC", Amount: amount}).Balance;
			lastGoldTime = currTimeSeconds();
		}		
	}		
	
	/************************* CONSTRUCTING ******************************/
	var construct = ((typeof userData.Construct != 'undefined') && (typeof userData.Construct.Value != 'undefined') && userData.Construct.Value != "") ? userData.Construct.Value.split('|') : "";
	for( i = 0; i < construct.length; i++)
	{
		if(construct[i] != "")
		{
			var info = construct[i].split(',');			// 0: Building Instance, 1: finish time, 2: itemClass, 3: next upgrade
						
			// Check if the progress finished
			if(info[1] <= currTimeSeconds())
			{
				// Increase Gold produce
				if( info[2] == "Hut")
				{
					var addNew = true;
					for( cnt = 0; cnt < goldGeneration.length; cnt++)
					{
						var data = goldGeneration[i].split(':');
						if( data[0] == info[0])
						{
							goldGeneration[i] = data[0] +":"+info[3];
							addNew = false;
						}
					}
					if( addNew )
						goldGeneration[goldGeneration.length] = info[0] +":"+info[3];
				}
				// Increase gold storage
				else if( info[2] == "Bank")
				{
					log += "\n Bank built or upgraded!";
					var addNew = true;
					for( cnt = 0; cnt < goldStorage.length; cnt++)
					{
						log += "\n - "+i+". "+ goldStorage[i];
						var data = goldStorage[i].split(':');
						if( data[0] == info[0])
						{
							goldStorage[i] = data[0] +":"+info[3];
							addNew = false;
						}
					}
					if( addNew )
						goldStorage[goldStorage.length] = info[0] +":"+info[3];					
				}			
				
				construct.splice(i, 1);
				needUpdate = true;
			}				
		}
	}		
	
	var constructString = (construct != "" ) ? construct.join("|") : ""; 
	var goldGenerationString = (goldGeneration != "" ) ? goldGeneration.join("|") : "";
	var goldStorageString = (goldStorage != "" ) ? goldStorage.join("|") : "";
	
	log += "\n Gold Generation String: "+goldGenerationString;
	log += "\n Gold Storage String: "+goldStorageString;

	/****************************** MINING ******************************/	
	var storages = {};
	
	var mine = ((typeof userData.Mine != 'undefined') && (typeof userData.Mine.Value != 'undefined') && userData.Mine.Value != "") ? userData.Mine.Value.split('|') : "";
	for( i = 0; i < mine.length; i++)
	{
		if(mine[i] != "")
		{
			var buildingInfo =  mine[i].split (':');
			var buildingInstanceID = buildingInfo [0];
				
			// Deserialize the building queue, and iterate through them
			var progresses = buildingInfo [1].split ('-');	
			for( j = 0; j < progresses.length; j++)
			{
				// If this progress is empty continue the cycle.
				if (progresses[j] == "") 
				{
					progresses.splice(j, 1);	
					continue;
				}
							
				var info = progresses[j].split (',');
			
				// Check if the progress finished
				if(info [0] <= currTimeSeconds())
				{			
					// Get the building instance
					var buildingInstance;
					for(cnt = 0; cnt < playerInventory.Inventory.length; cnt++)
					{
						if(playerInventory.Inventory[cnt].ItemInstanceId == buildingInstanceID)
							buildingInstance = playerInventory.Inventory[cnt];				
					}	
				
					if( typeof buildingInstance == 'undefined' )
						return { msg: log, error : "You don't own this item ("+buildingInstanceID+","+playerInventory.Inventory.length+")!", serverTime: currTimeSeconds()  }; 
						
					// Check if there is enough storage
					var amount = parseInt(info[1]);
					var storage = STORAGE_PER_UPGRADE * (parseInt(buildingInstance.CustomData.Upgrade)+1);
										
					var storedMaterials = 0
					if( typeof buildingInstance.CustomData.StoredMaterial != 'undefined')
						storedMaterials = parseInt(buildingInstance.CustomData.StoredMaterial);

					log += storedMaterials +"+"+ amount +"<="+ storage;		
					if( storedMaterials + amount <= storage )
					{
						// Update the buildings storage
						buildingInstance.CustomData.StoredMaterial = storedMaterials + amount; 
						server.UpdateUserInventoryItemCustomData({ PlayFabId: currentPlayerId, ItemInstanceId: buildingInstanceID, Data: buildingInstance.CustomData});
				
						storages[buildingInstanceID] = buildingInstance.CustomData.StoredMaterial;
				
						progresses.splice(j, 1);
						needUpdate = true;	
						log += " -> " + progresses.length;
					}						
				}					
			}
			
			log += i+". progress length: " + progresses.length;
			
			if( progresses.length == 0)
				mine.splice(i, 1);	
			else
				mine[i] = buildingInstanceID +":"+progresses.join('-');
		}
		else
			mine.splice(i, 1);	
	}		
	
	// Check storage size in the userdata		
	var mineString = (mine != "" ) ? mine.join("|") : ""; 
	log += "\nNew Mine Progress: "+mineString;
		
		
		
		
		
		
		
	/****************************** CRAFTING ******************************/	
	var craft = ((typeof userData.Craft != 'undefined') && (typeof userData.Craft.Value != 'undefined') && userData.Craft.Value != "") ? userData.Craft.Value.split('|') : "";
	for( i = 0; i < craft.length; i++)
	{
		if(craft[i] != "")
		{
			var buildingInfo =  craft[i].split (':');
			var buildingInstanceID = buildingInfo [0];
			
			// Deserialize the building queue, and iterate through them
			var progresses = buildingInfo [1].split ('-');		
			for( j = 0; j < progresses.length; j++)
			{
				// If this progress is empty continue the cycle.
				if (progresses[j] == "") continue;
				var info = progresses[j].split (',');
			
				// Check if the progress finished
				if(info [0] <= currTimeSeconds())
				{					
					server.GrantItemsToUser({ 
						PlayFabId: currentPlayerId, 
						CatalogVersion: info[2],
						ItemIds: [info[1]] 
						});
					
					progresses.splice(j, 1);
					needUpdate = true;
				}					
			}
			craft[i] = buildingInstanceID +":"+progresses.join('-');
			
			if( progresses.length == 0)
				craft.splice(i, 1);			
		}
	}		
	var craftString = (craft != "" ) ? craft.join("|") : ""; 
	
	
	
	
	
	
	/****************************** REPAIRING ******************************/	
	var repair = ((typeof userData.Repair != 'undefined') && (typeof userData.Repair.Value != 'undefined') && userData.Repair.Value != "") ? userData.Repair.Value.split('|') : "";
	for( i = 0; i < repair.length; i++)
	{
		var details = repair[i].split(",");	// 0:BuildingInstanceID, 1:lastCheck, 2:basePrice, 3:damage
		
		// Get the building
		var building;
		for(cnt = 0; cnt < playerInventory.Inventory.length; cnt++)
		{
			if(playerInventory.Inventory[cnt].ItemInstanceId == details[0])
				building = playerInventory.Inventory[cnt];				
		}	
		if( typeof building == 'undefined' )
			return { msg: log, error : "You don't own this item ("+details[0]+","+playerInventory.Inventory.length+")!", serverTime: currTimeSeconds()  }; 		
		
		var damage = parseInt(building.CustomData.DamageTaken);
					
		// Repaired amount until the last check
		var repairAmount = Math.round((currTimeSeconds() - parseFloat(details[1])) / TIME_TO_REPAIR_ONE_HEALTH); 
		damage -= repairAmount;
		if(damage < 0)
			damage = 0;	
			
		// Subtract Materials
		var upgrade = parseInt(building.CustomData.Upgrade);
		var percentage = repairAmount / parseInt(building.CustomData.HP) * upgrade;
		var amount = Math.floor(parseInt(details[2]) * percentage);
				
		if( amount <= 0 )
			amount = 1;
		
		// Check materials
		var errorMsg = CheckBuildingValue(playerInventory, upgrade, amount);
		if( errorMsg != "")
			return { error : errorMsg, serverTime: currTimeSeconds() }; 		
					
		// Subtract Virtual Currencies
		balance = SubtractCurrencyForBuilding(upgrade, amount, balance);
			
		// Update building hp	
		building.CustomData.DamageTaken = damage			
		server.UpdateUserInventoryItemCustomData({ PlayFabId: currentPlayerId, ItemInstanceId: details[0], Data: building.CustomData});
		
		if(damage == 0)
			repair.splice(i, 1);
		else
			repair[i] = details[0] +","+currTimeSeconds()+","+details[2]+","+damage;		
	}		
	var repairString = (repair != "" ) ? repair.join("|") : ""; 
	
	log += "\n Repairstring: " + repairString;
	
	
	
	/****************************** FINALIZE CHANGES ******************************/	
	
	if( needUpdate )
	{
		// Update the user data, and returns the results.
		server.UpdateUserData({
			PlayFabId: currentPlayerId,
			Data: {
				Construct : constructString,
				Mine : mineString,
				Craft: craftString,
				Repair: repairString,
				
				GoldGeneration: goldGenerationString,
				GoldStorage: goldStorageString,
				LastGoldTime: lastGoldTime+""
				
				},
		});		
	}
	return { msg: log, Balance: balance, 
			UserDataRepair: repairString, 
			UserDataConstruct: constructString, 
			UserDataMine: mineString, 
			BuildingStorages: storages,
			UserDataCraft: craftString,			
			GoldGeneration: goldGenerationString,
			GoldStorage: goldStorageString,		
			LastGoldTime: lastGoldTime,
			serverTime: currTimeSeconds() };
}




/* This function starts to repair a building.
 * Parameters: BuildingInstanceID
 * Steps:
 *   1. Check if the player has enough free worker.
 *   2. Calculate the missing HP
 *   3. Updating the repair data
 */
handlers.Repair = function (args)
{
	var log = "ServerLog - Repair handler (662.)\n *********\n";	
	var buildingInstanceID = args.BuildingInstanceID;
	
	var playerInventory = server.GetUserInventory({ PlayFabId: currentPlayerId, CatalogVersion: "Buildings" });	
	
	// Get repair & construct data
	var userData = server.GetUserData({ PlayFabId: currentPlayerId }).Data;
	
	// Check if have enough worker
	var underConstruction = ( typeof userData.Construct != 'undefined' && typeof userData.Construct.Value != 'undefined' ) ? userData.Construct.Value.split('|') : "";
	var repair = ( typeof userData.Repair != 'undefined' && typeof userData.Repair.Value != 'undefined' ) ? userData.Repair.Value.split('|') : "";
	
	if((typeof playerInventory.VirtualCurrency["0B"] < 1))
		return { error : "You don't have any worker!", serverTime: currTimeSeconds() };
	if(underConstruction.length + repair.length + 1 > playerInventory.VirtualCurrency["0B"])
		return { error : "Not enough worker (has "+ playerInventory.VirtualCurrency["0B"] + " and needs "+(underConstruction.length + repair.length + 1)+" )!", serverTime: currTimeSeconds() };
		
	// Get building
	var buildingInstance;
	for(cnt = 0; cnt < playerInventory.Inventory.length; cnt++)
	{
		if(playerInventory.Inventory[cnt].ItemInstanceId == buildingInstanceID)
			buildingInstance = playerInventory.Inventory[cnt];				
	}	

	if( typeof buildingInstance == 'undefined' )
		return { msg: log, error : "You don't own this item ("+buildingInstanceID+","+playerInventory.Inventory.length+")!", serverTime: currTimeSeconds()  }; 
		
	var catalogItem;
	var itemList = server.GetCatalogItems({ CatalogVersion: "Buildings" }).Catalog;
	for(i = 0; i < itemList.length; i++)
	{
		if(itemList[i].ItemId == buildingInstance.ItemId)
		{
			catalogItem = itemList[i];
			break;
		}
	}	
	// If there is no such item in the catalog, throw an error.
	if( typeof catalogItem == 'undefined' )
		return { error : "Can't find item ("+buildingInstance.ItemId+") in the Buildings catalog!", serverTime: currTimeSeconds()  }; 

		
	// Check missing & max hp
	var damage = parseInt(buildingInstance.CustomData.DamageTaken);	
	if( damage == 0)
		return { msg: log, error : "This building isn't damaged!", serverTime: currTimeSeconds()  }; 
	
	if( repair != "")
		repair += "|";
	repair += buildingInstanceID + ","+currTimeSeconds()+","+catalogItem.VirtualCurrencyPrices["WO"]+","+damage;
	
	// update repair data
	server.UpdateUserData({
		PlayFabId: currentPlayerId,
		Data: {Repair : repair},
	});
		
	// Return the informations
	return { msg : log, BuildingInstanceID: buildingInstanceID, UserDataRepair: repair, serverTime: currTimeSeconds() };
}


/* This function start constructing or upgrading a building.
 * Parameters: ItemID, Position, Upgrade (number, 0 = new building)
 * Steps:
 *   1. Check if the player has worker to use.
 *   2. Check if the player has enough material
 *   3. If this is a new building, buy it.
 *   4. Set the building data (Position and Upgrades)
 */
handlers.Construct = function (args)
{
	var log = "ServerLog - Construct handler (722.)\n *********\n";
	
	// Set the variables
	var itemID = args.ItemID;	
	var itemInstanceID = args.ItemInstanceID 	// Optional only for upgrading
	var position = args.Position;				// Where to place the constructed building
	var rotation = args.Rotation;
	
	// Query data
	var userData = server.GetUserData({ PlayFabId: currentPlayerId }).Data;
	var playerInventory = server.GetUserInventory({ PlayFabId: currentPlayerId, CatalogVersion: "Buildings" });	
	
	log += "ItemInstanceID: "+itemInstanceID+"\n";
	
	var itemInstance;
	if( typeof itemInstanceID != 'undefined' )
	{
		log += "Check for the item instance \n";
		
		for(i = 0; i < playerInventory.Inventory.length; i++)
		{
			log += " - "+playerInventory.Inventory[i].ItemInstanceId+" == "+itemInstanceID;
			if(playerInventory.Inventory[i].ItemInstanceId == itemInstanceID)
			{
				itemInstance = playerInventory.Inventory[i];
				break;
			}
		}	
	}
	
	/** 1. Check if the player has a free worker.	**/
	var underConstruction = ( typeof userData.Construct != 'undefined' && typeof userData.Construct.Value != 'undefined' ) ? userData.Construct.Value.split('|') : "";
	var repair = ( typeof userData.Repair != 'undefined' && typeof userData.Repair.Value != 'undefined' ) ? userData.Repair.Value.split('|') : "";
	
	if((typeof playerInventory.VirtualCurrency["0B"] < 1))
		return { error : "You don't have any worker!", serverTime: currTimeSeconds() };
	if(underConstruction.length + repair.length + 1 > playerInventory.VirtualCurrency["0B"])
		return { error : "Not enough worker (has "+ playerInventory.VirtualCurrency["0B"] + " and needs "+(underConstruction.length + 1)+" )!", serverTime: currTimeSeconds() };
	
	// Get the item data from the catalog
	var item;
	var itemList = server.GetCatalogItems({ CatalogVersion: "Buildings" }).Catalog;
	for(i = 0; i < itemList.length; i++)
	{
		if(itemList[i].ItemId == itemID)
		{
			item = itemList[i];
			break;
		}
	}	
	// If there is no such item in the catalog, throw an error.
	if( typeof item == 'undefined' )
		return { error : "Can't find item ("+itemID+") in the catalog ("+catalogVersion+")!", serverTime: currTimeSeconds()  }; 
		
	/** 2. Check if the player has enough material **/
	// Base price is X Wood. X is multiplied by every upgrades. 
	// New material is added after every 10th upgrades (Wood-Stone-Iron-Steel), and the price resets to the base price.
	
	var amount = parseInt(item.VirtualCurrencyPrices["WO"]);
	var balance = playerInventory.VirtualCurrency;
	
	var upgrade = 0;
	
	if( !itemInstance )
	{
		if(playerInventory.VirtualCurrency["WO"] < amount)
			return { error : "You don't have enough wood ("+amount+") to build this building!", serverTime: currTimeSeconds() }; 	
		if(playerInventory.VirtualCurrency["GC"] < item.VirtualCurrencyPrices["GC"])
			return { error : "You don't have enough gold ("+item.VirtualCurrencyPrices["GC"]+") to build this building!", serverTime: currTimeSeconds() }; 		
		
		if ( typeof amount != 'undefined' )		
			balance.WO = server.SubtractUserVirtualCurrency({ PlayFabId: currentPlayerId, VirtualCurrency: "WO", Amount: amount}).Balance;	
		
		if ( typeof item.VirtualCurrencyPrices["GC"] != 'undefined' )
			balance.GC = server.SubtractUserVirtualCurrency({ PlayFabId: currentPlayerId, VirtualCurrency: "GC", Amount: item.VirtualCurrencyPrices["GC"]}).Balance;		
	}
	else
	{		
		upgrade = parseInt(itemInstance.CustomData.Upgrade) + 1;
		
		// CHECK materials
		var errorMsg = CheckBuildingValue(playerInventory, upgrade, amount);
		if( errorMsg != "")
			return { error : errorMsg, serverTime: currTimeSeconds() }; 		
					
		// Subtract Virtual Currencies
		balance = SubtractCurrencyForBuilding(upgrade, amount, balance);				
	}
		
	/** 3a. If this is a new building add it to the player. **/
	if ( !itemInstance )
	{
		log += "Item instance is null ("+itemInstance+") -> new item will be granted!";
		var grantResult = server.GrantItemsToUser({
						CatalogVersion: "Buildings",
						PlayFabId: currentPlayerId,
						ItemIds: [itemID],
						Annotation: "Constructed.",
		}).ItemGrantResults;	
		
		// Granting the item failed
		if(!grantResult[0].Result)
			return { error : "Failed to grant the item ("+itemID+") to the user. " + grantResult[0].ItemId, serverTime: currTimeSeconds() };	
		
		itemInstanceID = grantResult[0].ItemInstanceId;
	}	
	
	// If the time is not instant
	var time = item.VirtualCurrencyPrices["0T"];
	
	data = (typeof userData.Construct != 'undefined' && typeof userData.Construct.Value != 'undefined') ? userData.Construct.Value : "";
	if(time > 0)
	{			
		if( data != "" )
			data += "|";
			
		data += itemInstanceID+","+ ( currTimeSeconds() + time ) + "," + item.ItemClass +","+upgrade;
		
		// Update the user "Crafting" data with this building.
		server.UpdateUserData({
				PlayFabId: currentPlayerId,
				Data: {Construct : data},
		});
	}
	
	// The custom data is a json string, first have to parse.
	// If only the Position would be updated in the UpdateUserInventoryItemCustomData method, it will
	// delete the other custom data fields for this item instance!
	var customData = JSON.parse(item.CustomData);	
	if( typeof position != "undefined")
	{
		customData.Rotation = rotation;
		customData.Position = position;
		customData.CurrHealth = customData.HP;
	}	
	else
		customData.CurrHealth = parseInt(customData.CurrHealth) + parseInt(customData.HP);
	
	customData.Upgrade = upgrade;

	
	// Update the position data of the building
	server.UpdateUserInventoryItemCustomData({
		PlayFabId: currentPlayerId,
		ItemInstanceId: itemInstanceID,
		Data: customData
	});
	
	// Return the informations
	return { msg : log, ItemInstanceID: itemInstanceID, UserDataConstruct: data, Upgrade: customData.Upgrade, Balance: balance, serverTime: currTimeSeconds() };
}



/*This function starts a minding progress
 * Parameters: ItemID, BuildingInstanceID, SlotNumber
 * Steps:
 *   1. Check if the player has enough material
 *   2. Check if there is a free slot (not necesserily the given slot!)
 *   3. Collect datas: Material, Amount, Time
 *   4. Start to mine ( update player data )
 */
handlers.Mine = function (args)
{
	var log = "ServerLog - Mine handler (903.)\n *********\n";
	var itemID = args.ItemID;
	var buildingInstanceID = args.ItemInstanceID;
	
	if( typeof buildingInstanceID == 'undefined' || buildingInstanceID == "")
		return { error : "Error: only a constructed building can mine!", serverTime: currTimeSeconds()  }; 
	
	// Get UserData
	var userData = server.GetUserData({ PlayFabId: currentPlayerId }).Data;
				
	// Get Building Instance
	var playerInventory = server.GetUserInventory({ PlayFabId: currentPlayerId, CatalogVersion: "Buildings" });	
	var buildingInstance;
	for(i = 0; i < playerInventory.Inventory.length; i++)
	{
		if(playerInventory.Inventory[i].ItemInstanceId == buildingInstanceID)
		{
			buildingInstance = playerInventory.Inventory[i];
			break;
		}
	}		
	if( typeof buildingInstance == 'undefined' )
		return { error : "You don't own this item ("+itemID+","+playerInventory.Inventory.length+")!", serverTime: currTimeSeconds()  }; 
		
	// Check for free mining slots	
	var cnt = -1;
	var mineProgresses = ( typeof userData.Mine != 'undefined' && typeof userData.Mine.Value != 'undefined' ) ? userData.Mine.Value.split('|') : "";
	for(i = 0; i < mineProgresses.length; i++)
	{
		var buildingData = mineProgresses[i].split(":");
		if( buildingData[0] == buildingInstanceID )
		{			
			var slots = buildingData[1].split("-");			
			if( slots.length >= parseInt(buildingInstance.CustomData.Upgrade / 10)+3)
				return { error : "You don't have free slot to make this material!", serverTime: currTimeSeconds()  }; 
			cnt = i;
		}		
	}	
	
	// Check prices
	var balance = playerInventory.VirtualCurrency;
	var pieces = 1 /*+parseInt(buildingInstance.CustomData.Upgrade)*/;
	var price = pieces * parseInt(buildingInstance.CustomData.Price);
	if(balance.GC < price)
		return { error : "You don't have enough gold!", serverTime: currTimeSeconds()  }; 		
	
	// Buy the material	
	balance.GC = server.SubtractUserVirtualCurrency({ PlayFabId: currentPlayerId, VirtualCurrency: "GC", Amount: price}).Balance;		
	
	var data = "";
	var finishTime = TIME_TO_MINE;	
	
	if( cnt >= 0 )
	{
		var buildingData = mineProgresses[cnt].split(":");	
		if(buildingData[1] != "" )
		{
			var progresses = buildingData[1].split("-");
			var last = progresses[progresses.length-1].split(",");						
			finishTime += parseFloat(last[0]);
			progresses[progresses.length] = finishTime+","+pieces+","+buildingInstance.CustomData.Material;
			
			buildingData[1] = progresses.join("-");
		}			
		mineProgresses[cnt] = buildingData.join(":");
		data = mineProgresses.join('|');
	}
	else
		data = buildingInstanceID+":"+(parseFloat(finishTime)+currTimeSeconds())+","+pieces+","+buildingInstance.CustomData.Material;
	
	server.UpdateUserData({			
		PlayFabId: currentPlayerId,
		Data: {Mine : data},
	});
	
	
	// MINE DATA: 
	//		[BuildingInstanceID] : [finish],[amount],[material] - [finish],[amount],[material] - [finish],[amount],[material] |
	// 		[BuildingInstanceID] : [finish],[amount],[material] - [finish],[amount],[material] - [finish],[amount],[material] |
		
	return { msg : log, UserDataMine: data, Balance: balance, serverTime: currTimeSeconds() };
}

handlers.CollectMaterials = function (args)
{
	var log = "ServerLog - CollectMaterials handler (988.)\n *********\n";
	var buildingInstanceID = args.ItemInstanceID;
	
	if( typeof buildingInstanceID == 'undefined' || buildingInstanceID == "")
		return { error : "Error: invalid building instance id!", serverTime: currTimeSeconds()  }; 
			
	// Get Building Instance
	var playerInventory = server.GetUserInventory({ PlayFabId: currentPlayerId, CatalogVersion: "Buildings" });	
	var buildingInstance;
	for(i = 0; i < playerInventory.Inventory.length; i++)
	{
		if(playerInventory.Inventory[i].ItemInstanceId == buildingInstanceID)
		{
			buildingInstance = playerInventory.Inventory[i];
			break;
		}
	}		
	if( typeof buildingInstance == 'undefined' )
		return { error : "You don't own this item ("+playerInventory.Inventory.length+")!", serverTime: currTimeSeconds()  }; 
	
	var material = buildingInstance.CustomData.Material;
	var amount = parseInt(buildingInstance.CustomData.StoredMaterial);
	var balance = playerInventory.VirtualCurrency;
	
	balance[material] = server.AddUserVirtualCurrency({ PlayFabId: currentPlayerId, VirtualCurrency: material, Amount: amount}).Balance;	
	buildingInstance.CustomData.StoredMaterial = 0;
	
	server.UpdateUserInventoryItemCustomData({ 
			PlayFabId: currentPlayerId, 
			ItemInstanceId: buildingInstanceID,
			Data: buildingInstance.CustomData
			});
	
	return { msg: log, Balance: balance, serverTime: currTimeSeconds() };
}

/* This function starts the craft progress.
 *  Parameters: BuildingInstanceID, ItemID, ItemCatalog
 *  
 */
handlers.Craft = function (args)
{
	var log = "ServerLog - Craft handler (1030.)\n *********\n";
	
	var itemID = args.ItemID;										// This is the item that will be crafted.
	var itemCatalog = args.ItemCatalog;								// The catalag of the item
	var buildingInstanceID = args.BuildingInstanceID; 				// This is the building instance ID, this building crafts the item.
	
	if( typeof buildingInstanceID == 'undefined' || buildingInstanceID == "")
		return { error : "Error: only a constructed building can mine!", serverTime: currTimeSeconds()  }; 
	
	// Get UserData
	var userData = server.GetUserData({ PlayFabId: currentPlayerId }).Data;
	
	// Get the card
	var catalog = server.GetCatalogItems({ CatalogVersion: itemCatalog }).Catalog;
	
	// Find item from the list
	var item;
	for(i = 0; i < catalog.length; i++)
	{
		if(catalog[i].ItemId == itemID)
		{
			item = catalog[i];
			break;
		}
	}	
	// If the item doesn't exists in this catalog
	if( typeof item == 'undefined' )
		return { error : "Can't find item ("+itemID+") in the inventory ("+itemCatalog+")!"  }; 
	
	
	// Get Building Instance
	
	var playerInventory = server.GetUserInventory({ PlayFabId: currentPlayerId, CatalogVersion: "Buildings" });	
	var buildingInstance;
	for(i = 0; i < playerInventory.Inventory.length; i++)
	{
		if(playerInventory.Inventory[i].ItemInstanceId == buildingInstanceID)
		{
			buildingInstance = playerInventory.Inventory[i];
			break;
		}
	}		
	if( typeof buildingInstance == 'undefined' )
		return { error : "You don't own this item ("+itemID+")!", serverTime: currTimeSeconds()  }; 
	
	var catalogVersion = "";
	//var catalogVersion = buildingInstance.customData.Catalog;
	
	// Check for free crafting slots	
	var cnt = -1;
	var craftProgresses = ( typeof userData.Craft != 'undefined' && typeof userData.Craft.Value != 'undefined' ) ? userData.Craft.Value.split('|') : "";
	for(i = 0; i < craftProgresses.length; i++)
	{
		var buildingData = craftProgresses[i].split(":");
		if( buildingData[0] == buildingInstanceID )
		{			
			var slots = buildingData[1].split("-");			
			if( slots.length >= parseInt(buildingInstance.CustomData.Upgrade / 10)+3)
				return { error : "You don't have free slot to make this card!", serverTime: currTimeSeconds()  }; 
			cnt = i;
		}		
	}	
	
	// Check prices
	var balance = playerInventory.VirtualCurrency;
	var price = item.VirtualCurrencyPrices.GC;
	if(balance.GC < price)
		return { error : "You don't have enough gold!", serverTime: currTimeSeconds()  }; 		
	
	// Buy the material	
	if( price > 0)
		balance.GC = server.SubtractUserVirtualCurrency({ PlayFabId: currentPlayerId, VirtualCurrency: "GC", Amount: price}).Balance;		
	
	var data = "";
	var finishTime = parseFloat(item.VirtualCurrencyPrices["0T"]);	
	
	if( cnt >= 0 )
	{
		var buildingData = craftProgresses[cnt].split(":");	
		if(buildingData[1] != "" )
		{
			var progresses = buildingData[1].split("-");
			var last = progresses[progresses.length-1].split(",");						
			finishTime += parseFloat(last[0]);
			progresses[progresses.length] = finishTime+","+itemID+","+catalogVersion;
			
			buildingData[1] = progresses.join("-");
		}			
		craftProgresses[cnt] = buildingData.join(":");
		data = craftProgresses.join('|');
	}
	else
		data = buildingInstanceID+":"+(parseFloat(finishTime)+currTimeSeconds())+","+itemID+","+catalogVersion;
	
	server.UpdateUserData({			
		PlayFabId: currentPlayerId,
		Data: {Craft : data},
	});
	
	
	// CRAFT DATA: 
	//		[BuildingInstanceID] : [finish],[itemID],[catalogVersion] - [finish],[itemID],[catalogVersion] - [finish],[itemID],[catalogVersion] |
	// 		[BuildingInstanceID] : [finish],[itemID],[catalogVersion] - [finish],[itemID],[catalogVersion] - [finish],[itemID],[catalogVersion] |
		
	return { msg : log, UserDataCraft: data, Balance: balance, serverTime: currTimeSeconds() };
}





/* This function buys a character and grant it to the user.
 *  Parameters: ItemID  
 */
handlers.BuyCharacter = function (args)
{
	var log = "ServerLog - BuyCharacter handler (1144.)\n *********\n";
	
	var itemID = args.ItemID;
	
	// Get the card
	var catalog = server.GetCatalogItems({ CatalogVersion: "Characters" }).Catalog;
	
	// Find item from the list
	var item;
	for(i = 0; i < catalog.length; i++)
	{
		if(catalog[i].ItemId == itemID)
		{
			item = catalog[i];
			break;
		}
	}	
	// If the item doesn't exists in this catalog
	if( typeof item == 'undefined' )
		return { error : "Can't find item ("+itemID+") in the catalog ("+itemCatalog+")!"  }; 
	
	var customData = JSON.parse(item.CustomData);
	
	// Get Building Instance
	var playerInventory = server.GetUserInventory({ PlayFabId: currentPlayerId, CatalogVersion: "Characters" });	
		
	// Check prices
	var balance = playerInventory.VirtualCurrency;
	var price = item.VirtualCurrencyPrices.GC;
	if(balance.GC < price)
		return { error : "You don't have enough gold!", serverTime: currTimeSeconds()  }; 		
	
	// Buy the character
	if( price > 0)
		balance.GC = server.SubtractUserVirtualCurrency({ PlayFabId: currentPlayerId, VirtualCurrency: "GC", Amount: price}).Balance;		
	
	var data = "";

	var itemsToGrant = [itemID];
	var grantResult = server.GrantItemsToUser({
						PlayFabId: currentPlayerId,
						CatalogVersion: "Characters",
						ItemIds: itemsToGrant,
						Annotation: "Crafted.",
					}).ItemGrantResults;
				
	// Granting the item failed
	if(!grantResult[0].Result)
		return { error : "Failed to grant the item ("+itemsToGrant+") to the user." + log};		
		
	for(cnt = 0; cnt < grantResult.length; cnt++)
	{
		// Grant character to user
		grantResult[cnt].ItemInstanceId = server.GrantCharacterToUser({
								PlayFabId: currentPlayerId,
								CharacterName: grantResult[cnt].DisplayName,
								CharacterType: grantResult[cnt].ItemId,
						}).CharacterId;
						
		// Add the native card to the character
		var nativeCardId = customData.NativeCard;
		
		var itemGrantResult = server.GrantItemsToCharacter({
					PlayFabId: currentPlayerId,
					CharacterId: grantResult[0].ItemInstanceId,
					CatalogVersion: "MagicCards"
					ItemIds: [nativeCardId]
			}).ItemGrantResults;
			
		log += "\nInstanceID: " + itemGrantResult[0].ItemInstanceId;
		
	}	
		
	return { msg : log, 
			GrantedCharacterID: grantResult[0].ItemId, 
			GrantedCharacterInstanceID: grantResult[0].ItemInstanceId,
		//	NativeCardID: customData.NativeCard, 
		//	NativeCardInstance: grantResult[0].NativeCard, 
			Balance: balance,
			serverTime: currTimeSeconds() };
}





// query all the player characters and send back to the client
handlers.getItems = function(args)
{
	var items = [];
	var x = 0;
	for (i = 0; i < args.Catalogs.length; i++) 
	{ 
		var cat = server.GetCatalogItems({ CatalogVersion: args.Catalogs[i] }).Catalog;
		for( j = 0; j < cat.length; j++)
		{
			items[x] = cat[j];
			x++;
		}
	}	
	return { itemlist : items };	
}


/* This function goes through the player's squad and
 * - removes all defense cards from every character.
 * - gives an amount of xp to the squad based on whether or not the player won.
 * - gives an amount of gold to the player based on whether or not the player won.
 */
handlers.battleReward = function(args)
{
	var log = "ServerLog - BattleReward handler (1244.)\n *********\n ";
	
	var won = args.Won == "True";
	
	var goldReward = GOLD_REWARD;
	if( !won ) goldReward = Math.floor(goldReward / 2);
	
	var xpReward = XP_REWARD;
	if( !won ) xpReward = Math.floor(xpReward / 2);
	
	// Get the squad
	var userdata = server.GetUserData({ PlayFabId: currentPlayerId, Keys: ["Squad", "Wins", "Loses", "XP"]}).Data;
	var squad = userdata.Squad.Value.split("|");
	var characters = server.GetAllUsersCharacters({ PlayFabId: currentPlayerId }).Characters;
	
	// Iterate through the player character
	log += "Iterate through "+ characters.length+" character:\n";
	for (i = 0; i < characters.length; i++) 
	{		
		// if the squad contains this character
		if( squad.indexOf(characters[i].CharacterId) > -1)
		{			
			// Add XP
			var stats = server.GetCharacterData({ PlayFabId: currentPlayerId, CharacterId: characters[i].CharacterId, Keys: ["XP"]}).Data;
			var xp = (typeof stats.XP != 'undefined' && stats.XP.Value != "") ? parseInt(stats.XP.Value) + xpReward : xpReward;
						
			server.UpdateCharacterData({
				PlayFabId: currentPlayerId,
				CharacterId: characters[i].CharacterId,
				Data: {XP : xp}
				});
			
			// Destroy every defense card			
			var defenseCards = server.GetCharacterInventory({
					PlayFabId: currentPlayerId,
					CharacterId: characters[i].CharacterId,
					CatalogVersion: "DefenseCards"
			}).Inventory;
			
			for(j = 0; j < defenseCards.length; j++)
			{
				server.MoveItemToUserFromCharacter({ 
					PlayFabId: currentPlayerId,
					CharacterId:characters[i].CharacterId, 
					ItemInstanceId: defenseCards[j].ItemInstanceId,
					});
				
				server.ModifyItemUses({ PlayFabId: currentPlayerId, ItemInstanceId:  defenseCards[j].ItemInstanceId, UsesToAdd: -1 * parseInt(defenseCards[j].RemainingUses) });				
			}
			
		}
	}
		
	var goldBalance = server.AddUserVirtualCurrency({
							PlayFabId: currentPlayerId,
							VirtualCurrency: "GC",
							Amount: goldReward
						}).Balance;
	
	var wins = (typeof userdata.Wins != 'undefined' && userdata.Wins.Value != "") ? parseInt(userdata.Wins.Value) : 0;
	var loses = (typeof userdata.Loses != 'undefined' && userdata.Loses.Value != "") ? parseInt(userdata.Loses.Value) : 0;
	var xp =  (typeof userdata.XP != 'undefined' && userdata.XP.Value != "") ? parseInt(userdata.XP.Value) : 0;
	
	if( won )
		wins += 1;
	else
		loses += 1;
	
	xp += xpReward;
	
	server.UpdateUserData({
			PlayFabId: currentPlayerId,
			Data: {
				Wins : wins,
				Loses : loses,
				XP : xp
				},
		});
	
	return { msg: log, GoldBalance: goldBalance, GoldReward: goldReward, XPReward: xpReward };
}


handlers.raidReward = function(args)
{
	var log = "ServerLog - Raid Reward handler (1322.)\n *********\n ";
	
	var enemyPlayerID = args.EnemyPlayerID;
	var currencies = args.Currencies.split("|");
	var cards = args.Cards.split("|");
	var buildings = args.Buildings.split("|");
	
	log += "EnemyPlayerID: " + args.EnemyPlayerID + "\n - Currencies: " +args.Currencies+"\n - Cards: "+args.Cards+"\n\n";
	
	var enemyInventory = server.GetUserInventory({ PlayFabId: enemyPlayerID });
	var inventory = enemyInventory.Inventory;
	var materials = enemyInventory.VirtualCurrency;
	
	// Remove currency
	for(var i = 0; i < currencies.length; i++)
	{
		var material = currencies[i].split(":");
		var amount = parseInt(material[1]);
		
		if( materials[material[0]] < amount )
			amount = materials[material[0]];
		
		if( amount > 0 )
		{
			server.SubtractUserVirtualCurrency({ PlayFabId: enemyPlayerID, VirtualCurrency: material[0], Amount: amount });
			server.AddUserVirtualCurrency({ PlayFabId: currentPlayerId, VirtualCurrency: material[0], Amount: amount });
		}
	
		log += "Amount of "+ material[0] + ": " + amount + "("+material[1]+") target player has: " + materials[material[0]];	
	}
		
	// Transfer card
	//var itemIdsByCatalog = {};
	
	/*for(var j = 0; j < cards.length; j++)
	{
		if( cards[j] != "")
		{
			var info = cards[j].split(":");			
			server.RevokeInventoryItem({PlayFabId: enemyPlayerID, ItemInstanceId: info[0]});
			
			if( typeof itemIdsByCatalog[info[2]] == "undefined")
				itemIdsByCatalog[info[2]] = [];			
			
			itemIdsByCatalog[info[2]][itemIds.length] = info[1];
		}
	}*/
	
	// Update building health
	var buildingDamages = {}
	for( k = 0; k < buildings.length; k++)
	{
		var info = buildings[k].split(":");
		buildingDamages[info[0]] = parseInt(info[1]);
	}	
	for( cnt = 0; cnt < inventory.length; cnt++)
	{
		if( typeof buildingDamages[inventory[cnt].ItemInstanceId] != 'undefined' )
			server.UpdateUserInventoryItemCustomData({
				PlayFabId: enemyPlayerID, 
				ItemInstanceId: inventory[cnt].ItemInstanceId,
				Data: { DamageTaken: buildingDamages[inventory[cnt].ItemInstanceId] }
				});				
	}
	
/*	for (var key in itemIdsByCatalog) 
	{
		if( itemIdsByCatalog[key].length > 0)
			server.GrantItemsToUser({
				PlayFabId: currentPlayerId, 
				CatalogVersion: key,
				ItemIds: itemIdsByCatalog[key]
				});
	}*/
	
	return { msg: log };
}








/*********************************************************************************
*********************************** ADMIN FUNCTIONS ******************************
**********************************************************************************/

/* Deletes every character of the specified player.
 * Paramters: Username
 */
handlers.deleteAllCharacter = function(args)
{
	var user = GetUserAccountInfo( { Username: args.Username });
	if( user == null )
		return { msg : "The user with '"+args.Username+"' username doesn't exists!"}
	
	var characters = server.GetAllUsersCharacters( {  PlayFabId: user.PlayFabId } ).Characters;
	for(i = 0; i<characters.length; i++)
	{
		server.DeleteCharacterFromUser({
			PlayFabId: user.PlayFabId,
			CharacterId: characters[i].CharacterId,
		});
	}
	return { msg: "Deleted every character of the '"+args.Username+"' player "  };
}
