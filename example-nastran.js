//
//
//   Version 0.3
//     positive and negative variablse
//   Date: 13:49 2017/12/17
//


//-----------------------------------
//   Modules 
//-----------------------------------
var path = require('path');    
const fs = require('fs');
const os = require('os');
const cp = require('child_process');
var BFGS = require ("optalgo").BFGS ;
var NSGA = require ("optalgo").NSGA ;
var Model = require ("optalgo").OptModel 
var bdfParser = require('bdfparser');
const LineByLine = require('readlinesyn'); 
var f06Parser = require('f06parser'); 

var saver = require('modelsaver'); 

var BMW5ShellList = require( "./optVarList.json" );
var optResultJson = {};


//-----------------------------------
//   Module objects 
//-----------------------------------
var exec = require('child_process').exec; 

var liner = new LineByLine();

var theParser = new bdfParser.YBDFParser( ); 
var database = bdfParser.YDatabase();
var thef06Parser = new f06Parser( );


var database = new saver(); 

//-----------------------------------
// Global variables  
//-----------------------------------

var bendingSourceBDFFileName =  "./BMW5_bending.bdf";
var torsionSourceBDFFileName =  "./BMW5_torsion.bdf";



var taskName = 'result';
var resultfilename =  taskName + '.f06'

var currentDir = __dirname;
var  BDFfilename = './' + taskName + '.bdf'

var SERIALNUMBER = 1;



//
//  Design variables number
//
var DVNUMBER = 362;    // 363 
 
//-----------------------------------
//   Initilization
//-----------------------------------
thef06Parser.setPath( path.join(__dirname, taskName + '.f06') );  

var macAddress = [];
var adapter = os.networkInterfaces() 
for( id in adapter )
 {        
       var theAdapter = adapter[id];  
       var address = theAdapter[0] ;
       macAddress.push( address['mac'] )
}  
theParser.password( macAddress[0].split(':') );
 

theParser.init(); 
theParser.setReportStep( 10000 );
theParser.addCardType('CPENTA');
theParser.addCardType('PLOTEL');

// 
//  
GA = new NSGA();
GA.setMINMAX( -1 );
GA.setGENERATION( 200 );
GA.setPOPULATIONSIZE( 30 );
GA.setCROSSOVERPROBABILITY( 0.8 );
var Solver =  GA ; 

//
// optimization models 
var theModel = new  Model(); 
theModel.setModelName("BMW_torsion");  

optResultJson["No"] = 0;

for( key in BMW5ShellList )
{
    var thickness = parseFloat(BMW5ShellList[key]);
    var variableName = 'x_' + key;
    theModel.setVariable( variableName ,  thickness ) ;
    theModel.setVariableLowerLimit( variableName ,  parseFloat( 0.4 ) ) ;
    theModel.setVariableUpperLimit( variableName ,  parseFloat( thickness ) + 1.0 ) ;
    optResultJson[key] = thickness;
}
var NDV =  theModel.getVariablesNumber();

console.log( 'design variable number: ' + NDV );

//
// create database 
//
database.openDatabase('./bmw_tori_opt.db'); 
//database.executeSQLCommand("CREATE TABLE result ( id INTEGER PRIMARY KEY,  totalmass REAL,  torsion_displace REAL)");

//-----------------------------------
//   Methods
//-----------------------------------

//----------------------------------- 
//  Run Nastran jobs
//
function runNastran( )
{
    console.log( Date() + ' start Nastran analysis ' ) ;
    var nastranPath = 'D:\\MSC.Software\\MSC_Nastran\\20121\\msc20121\\win64\\nastran.exe';
    var command = nastranPath + ' ' + BDFfilename;
    cp.execSync( command );
}

function parseResult()
{
    return thef06Parser.extract();
}


//-----------------------------------
//  Create bdf files 
//
function writeBendingBDFfile( name )
{
    theParser.openTargetFile( name );

    theParser.writeTargetFile('SOL 101 ');
    theParser.writeTargetFile('CEND ');
    // $ Direct Text Input for Global Case Control Data
    theParser.writeTargetFile('TITLE = BMW BIW Analysis');
    theParser.writeTargetFile('ECHO = NONE ');
    theParser.writeTargetFile('SUBCASE 1 ');
    // $ Subcase name : Default
    theParser.writeTargetFile('   SUBTITLE=Default ');
    theParser.writeTargetFile('   SPC = 2 ');
    theParser.writeTargetFile('   LOAD = 3 ');
    theParser.writeTargetFile('   ELSUM = ALL ');
    theParser.writeTargetFile('   DISPLACEMENT(SORT1,REAL)=ALL ');
    //theParser.writeTargetFile('   SPCFORCES(SORT1,REAL)=ALL ');
    //theParser.writeTargetFile('   STRESS(SORT1,REAL,VONMISES,BILIN)=ALL ');
    theParser.writeTargetFile('BEGIN BULK ');
    // $ Direct Text Input for Bulk Data
    theParser.writeTargetFile('PARAM    POST    0 ');
    theParser.writeTargetFile('PARAM    GRDPNT  0 ');
    theParser.writeTargetFile('PARAM   PRTMAXIM YES ');
    //theParser.writeDataVector('PARAM');

    theParser.writeDataVector('PSHELL');

    theParser.writeDataVector('CHEXA');
    theParser.writeDataVector('CPENTA'); 
    theParser.writeDataVector('CTETRA');

    theParser.writeDataVector('CTRIA3');

    theParser.writeDataVector('RBE2'); 
    theParser.writeDataVector('RBE3'); 

    theParser.writeDataVector('PLOTEL');
    theParser.writeDataVector('PSOLID');

    theParser.writeDataVector('GRID');  
    theParser.writeDataVector('CBUSH');  
    theParser.writeDataVector('PBUSH'); 
 
    theParser.writeDataVector('CQUAD4'); 

    theParser.writeDataVector('MAT1'); 

    theParser.writeDataVector('SPCADD'); 
    theParser.writeDataVector('LOAD'); 

    //theParser.writeDataVector('SPC1'); 
    //theParser.writeDataVector('FORCE'); 
    //theParser.writeDataVector('MOMENT'); 

    theParser.writeTargetFile('$ Displacement Constraints of Load Set : spc1.1');
    theParser.writeTargetFile('SPC1     1       123    50010615');
    theParser.writeTargetFile('SPC1     1       123    50010616');
    theParser.writeTargetFile('SPC1     1       123    50010618');
    theParser.writeTargetFile('SPC1     1       123    50010619');
    theParser.writeTargetFile('$ Nodal Forces of Load Set : force.1');
    theParser.writeTargetFile('FORCE    1      36024179 0      3210.6   0.      0.     -1.');
    theParser.writeTargetFile('FORCE    1      37072973 0      3210.6   0.      0.     -1.');

    // End data bulk 
    theParser.writeTargetFile('ENDDATA  ');
    theParser.closeTargetFile( ); 
}


function writeTorsionBDFfile( name )
{
    theParser.openTargetFile( name );

    theParser.writeTargetFile('SOL 101 ');
    theParser.writeTargetFile('CEND ');
    // $ Direct Text Input for Global Case Control Data
    theParser.writeTargetFile('TITLE = BMW BIW Analysis');
    theParser.writeTargetFile('ECHO = NONE ');
    theParser.writeTargetFile('SUBCASE 1 ');
    // $ Subcase name : Default
    theParser.writeTargetFile('   SUBTITLE=Default ');
    theParser.writeTargetFile('   SPC = 2 ');
    theParser.writeTargetFile('   LOAD = 3 ');
    theParser.writeTargetFile('   ELSUM = ALL ');
    theParser.writeTargetFile('   DISPLACEMENT(SORT1,REAL)=ALL ');
    //theParser.writeTargetFile('   SPCFORCES(SORT1,REAL)=ALL ');
    //theParser.writeTargetFile('   STRESS(SORT1,REAL,VONMISES,BILIN)=ALL ');
    theParser.writeTargetFile('BEGIN BULK ');
    // $ Direct Text Input for Bulk Data
    theParser.writeTargetFile('PARAM    POST    0 ');
    theParser.writeTargetFile('PARAM    GRDPNT  0 ');
    theParser.writeTargetFile('PARAM   PRTMAXIM YES ');
    //theParser.writeDataVector('PARAM');

    theParser.writeDataVector('PSHELL');

    theParser.writeDataVector('CHEXA');
    theParser.writeDataVector('CPENTA'); 
    theParser.writeDataVector('CTETRA');

    theParser.writeDataVector('CTRIA3');

    theParser.writeDataVector('RBE2'); 
    theParser.writeDataVector('RBE3'); 

    theParser.writeDataVector('PLOTEL');
    theParser.writeDataVector('PSOLID');

    theParser.writeDataVector('GRID');  
    theParser.writeDataVector('CBUSH');  
    theParser.writeDataVector('PBUSH'); 
 
    theParser.writeDataVector('CQUAD4'); 

    theParser.writeDataVector('MAT1'); 

    theParser.writeDataVector('SPCADD'); 
    theParser.writeDataVector('LOAD'); 

    //theParser.writeDataVector('SPC1'); 
    //theParser.writeDataVector('FORCE'); 
    //theParser.writeDataVector('MOMENT'); 

    theParser.writeTargetFile('$ Displacement Constraints of Load Set : spc1.1');
    theParser.writeTargetFile('SPC1     1       3      50010617');
    theParser.writeTargetFile('SPC1     1       123    50010618');
    theParser.writeTargetFile('SPC1     1       123    50010619');
    theParser.writeTargetFile('$ Nodal Forces of Load Set : force.1');
    theParser.writeTargetFile('FORCE    1      50010615 0      3210.6   0.      0.     -1.');
    theParser.writeTargetFile('FORCE    1      50010616 0      3210.6   0.      0.     1.');

    // End data bulk 
    theParser.writeTargetFile('ENDDATA  ');
    theParser.closeTargetFile( ); 
}

//
// clean temperate files 
function cleanTempFile()
{
    var clearCommand = 'del result.f04';  
    cp.execSync( clearCommand );

    clearCommand = 'del result.log';  
    cp.execSync( clearCommand );

    clearCommand = 'del result.op2';  
    cp.execSync( clearCommand );

    clearCommand = 'del result.plt';  
    cp.execSync( clearCommand );

    clearCommand = 'del result.xdb';  
    cp.execSync( clearCommand );

    clearCommand = 'del result.aeso';  
    cp.execSync( clearCommand );
}

// 
// 
function updateBMWModel( theJSON )
{
    if( undefined == theJSON )
    {
         return;
    }
    try{   
       for( key in theJSON )
       {
          var index = parseInt( key )
          var thickness = parseFloat( theJSON[key] );
          theParser.update("PSHELL",  parseInt(index), parseInt(3) , thickness );

          optResultJson[key] = thickness;

       }
    } catch(exp) {
          console.log(exp);
    }
}

// 
// 
function eval( ) 
{
    var totalmass = 0.0;
    var displace = 0.0;    
    var record = []; 
    record.push( SERIALNUMBER );


    for(var key in BMW5ShellList )
    {
        var variableName = 'x_' + key;
        var thickness = theModel.getVariable( variableName ) ;

        thickness = parseFloat(thickness).toFixed(1);
        BMW5ShellList[key] = thickness; 
        theModel.setVariable( variableName, parseFloat(thickness)  ) ;
        // theParser.update("PSHELL",  parseInt(key), parseInt(3) , parseFloat(thickness).toFixed(1) );
        record.push( parseFloat(thickness).toFixed(1) );
    }
    updateBMWModel( BMW5ShellList );

    cleanTempFile();
    writeTorsionBDFfile( BDFfilename )
    runNastran();


    var r = thef06Parser.extractMass();
    totalmass = parseFloat( r['SUPPORTED ELEMENT TYPES'] );
    console.log( Date() + ' totalmass = %d', totalmass ) ;  

    r = thef06Parser.extractGridDisplacement( 50010615 );
    torsion_displace_1 = parseFloat( r["Disp"] );
    r = thef06Parser.extractGridDisplacement( 50010616 );
    torsion_displace_2 = parseFloat( r["Disp"] );

    torsion_displace = Math.abs( torsion_displace_1 ) +  Math.abs( torsion_displace_2 );
    console.log( 'torsion_displace = %d', torsion_displace ) ;

 


    theModel.setObject( "totalmass" , totalmass );
    theModel.setObject( "torsdisplace" , torsion_displace ); 
    // theModel.setObject( "benddisplace" , bending_displace );


    optResultJson["totalmass"] = totalmass ;
    optResultJson["torsdisplace"] = torsion_displace;

    record.push( parseFloat( totalmass ).toFixed(5) );
    //record.push( parseFloat( bending_displace ).toFixed(5) );
    record.push( parseFloat( torsion_displace ).toFixed(5) );
      fs.appendFileSync('./bmwoptresult.txt', record.join('\t') + '\r\n' );
    // fs.appendFileSync('./bmwoptresult.txt', JSON.stringify(optResultJson, null, " " ) + '\r\n' );

    SERIALNUMBER++;
}
  
//  
// the intial step
//
// eval( ); 
theParser.open( torsionSourceBDFFileName );

// 0.38852	3.34750
theModel.setObject( "totalmass" ,   0.38852   );
theModel.setObject( "torsdisplace" ,   3.34750    );
// theModel.setObject( "benddisplace" ,   0.94838   );


database.initOptModel( theModel ); 
Solver.initialize( theModel ); 

do{  
  eval();  
  database.save( theModel ); 
  Solver.renewModel( theModel ); 
} while(  ! Solver.isComplete() ) 
 
 
database.closeDatabase();  
 
