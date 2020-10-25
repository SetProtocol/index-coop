pragma solidity ^0.6.10;

import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ISetToken } from "../interfaces/ISetToken.sol";
import { IIndexModule } from "../interfaces/IIndexModule.sol";
import { IStreamingFeeModule } from "../interfaces/IStreamingFeeModule.sol";
import { PreciseUnitMath } from "../lib/PreciseUnitMath.sol";
import { TimeLockUpgrade } from "../lib/TimeLockUpgrade.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract ICManager is TimeLockUpgrade {
    using Address for address;
    using SafeMath for uint256;
    using PreciseUnitMath for uint256;

    /* ============ Modifiers ============ */

    /**
     * Throws if the sender is not the SetToken operator
     */
    modifier onlyOperator() {
        require(msg.sender == operator, "Must be operator");
        _;
    }

    /**
     * Throws if the sender is not the SetToken methodologist
     */
    modifier onlyMethodologist() {
        require(msg.sender == methodologist, "Must be methodologist");
        _;
    }

    /**
     * Throws if the sender is not the SetToken operator or methodologist
     */
    modifier onlyOperatorOrMethodologist() {
        require(
            msg.sender == operator || msg.sender == methodologist,
            "Must be operator or methodologist"
        );
        _;
    }

    /* ============ State Variables ============ */

    // Instance of SetToken
    ISetToken public setToken;

    // Address of IndexModule for managing rebalances
    IIndexModule public indexModule;

    // Address of StreamingFeeModule
    IStreamingFeeModule public feeModule;

    // Address of operator
    address public operator;

    // Address of methodologist
    address public methodologist;

    // Percent in 1e18 of streamingFees sent to operator
    uint256 public operatorFeeSplit;

    // Hash of (proposed feeSplit, proposing address)
    bytes32 public proposedFeeSplitHash;

    // Hash of (proposed feeRecipient, proposing address)
    bytes32 public proposedFeeRecipientHash;

    // Hash of (proposed timeLockPeriod, proposing address)
    bytes32 public proposedTimeLockPeriodHash;

    // Hash of (proposed manager, proposing address)
    bytes32 public proposedManagerHash;

    /* ============ Constructor ============ */

    constructor(
        ISetToken _setToken,
        IIndexModule _indexModule,
        IStreamingFeeModule _feeModule,
        address _operator,
        address _methodologist,
        uint256 _operatorFeeSplit
    )
        public
    {
        require(
            _operatorFeeSplit <= PreciseUnitMath.preciseUnit(),
            "Operator Fee Split must be less than 1e18"
        );
        
        setToken = _setToken;
        indexModule = _indexModule;
        feeModule = _feeModule;
        operator = _operator;
        methodologist = _methodologist;
        operatorFeeSplit = _operatorFeeSplit;
    }

    /* ============ External Functions ============ */

    /**
     * OPERATOR ONLY: Start rebalance in IndexModule. Set new target units, zeroing out any units for components being removed from index.
     * Log position multiplier to adjust target units in case fees are accrued. Validate that weth is not a part of the new allocation 
     * and that all components in current allocation are in _components array.
     *
     * @param _components               Array of components in new allocation plus any components removed from old allocation
     * @param _targetUnits              Array of target units at end of rebalance, maps to same index of component, if component
     *                                  being removed set to 0.
     * @param _positionMultiplier       Position multiplier when target units were calculated, needed in order to adjust target units
     *                                  if fees accrued
     */
    function startRebalance(
        IERC20[] calldata _components,
        uint256[] calldata _targetUnits,
        uint256 _positionMultiplier
    )
        external
        onlyOperator
    {
        indexModule.startRebalance(_components, _targetUnits, _positionMultiplier);
    }

    /**
     * OPERATOR ONLY: Set trade maximums for passed components
     *
     * @param _components            Array of components
     * @param _tradeMaximums         Array of trade maximums mapping to correct component
     */
    function setTradeMaximums(
        IERC20[] calldata _components,
        uint256[] calldata _tradeMaximums
    )
        external
        onlyOperator
    {
        indexModule.setTradeMaximums(_components, _tradeMaximums);
    }

    /**
     * OPERATOR ONLY: Set exchange for passed components
     *
     * @param _components        Array of components
     * @param _exchanges         Array of exchanges mapping to correct component, uint256 used to signify exchange
     */
    function setAssetExchanges(
        IERC20[] calldata _components,
        uint256[] calldata _exchanges
    )
        external
        onlyOperator
    {
        indexModule.setExchanges(_components, _exchanges);
    }

    /**
     * OPERATOR ONLY: Set exchange for passed components
     *
     * @param _components           Array of components
     * @param _coolOffPeriods       Array of cool off periods to correct component
     */
    function setCoolOffPeriods(
        IERC20[] calldata _components,
        uint256[] calldata _coolOffPeriods
    )
        external
        onlyOperator
    {
        indexModule.setCoolOffPeriods(_components, _coolOffPeriods);
    }

    /**
     * OPERATOR ONLY: Toggle ability for passed addresses to trade from current state 
     *
     * @param _traders           Array trader addresses to toggle status
     */
    function updateTraderStatus(
        address[] calldata _traders
    )
        external
        onlyOperator
    {
        indexModule.updateTraderStatus(_traders);
    }

    /**
     * OPERATOR ONLY: Toggle whether anyone can trade, bypassing the traderAllowList 
     */
    function updateAnyoneTrade() external onlyOperator {
        indexModule.updateAnyoneTrade();
    }

    /**
     * Accrue fees from streaming fee module and transfer tokens to operator / methodologist addresses based on fee split
     */
    function accrueFee() public {
        feeModule.accrueFee(setToken);

        uint256 setTokenBalance = setToken.balanceOf(address(this));

        uint256 operatorTake = setTokenBalance.preciseMul(operatorFeeSplit);

        setToken.transfer(operator, operatorTake);

        setToken.transfer(methodologist, setTokenBalance.sub(operatorTake));
    }

    /**
     * OPERATOR OR METHODOLOGIST ONLY: Update the SetToken manager address. Operator and Methodologist must each call
     * this function to execute the update.
     *
     * @param _newManager           New manager address
     */
    function updateManager(address _newManager) external onlyOperatorOrMethodologist {
        address nonCaller = _getNonCaller();

        bytes32 expectedHash = keccak256(abi.encodePacked(_newManager, nonCaller));

        if (expectedHash == proposedManagerHash) {
            setToken.setManager(_newManager);
            proposedManagerHash = bytes32(0);
        } else {
            proposedManagerHash = keccak256(abi.encodePacked(_newManager, msg.sender));
        }
    }

    /**
     * OPERATOR ONLY: Add a new module to the SetToken.
     *
     * @param _module           New module to add
     */
    function addModule(address _module) external onlyOperator {
        setToken.addModule(_module);
    }

    /**
     * OPERATOR ONLY: Interact with a module registered on the SetToken. Cannot be used to call functions in the
     * fee module, due to ability to bypass methodologist permissions to update streaming fee.
     *
     * @param _module           Module to interact with
     * @param _data             Byte data of function to call in module
     */
    function interactModule(address _module, bytes calldata _data) external onlyOperator {
        require(_module != address(feeModule), "Must not be fee module");

        // Invoke call to module, assume value will always be 0
        _module.functionCallWithValue(_data, 0);
    }

    /**
     * OPERATOR ONLY: Remove a new module from the SetToken.
     *
     * @param _module           Module to remove
     */
    function removeModule(address _module) external onlyOperator {
        setToken.removeModule(_module);
    }

    /**
     * METHODOLOGIST ONLY: Update the streaming fee for the SetToken. Subject to timelock period agreed upon by the
     * operator and methodologist
     *
     * @param _newFee           New streaming fee percentage
     */
    function updateStreamingFee(uint256 _newFee) external timeLockUpgrade onlyMethodologist {
        feeModule.updateStreamingFee(setToken, _newFee);
    }

    /**
     * OPERATOR OR METHODOLOGIST ONLY: Update the fee recipient address. Operator and Methodologist must each call
     * this function to execute the update.
     *
     * @param _newFeeRecipient           New fee recipient address
     */
    function updateFeeRecipient(address _newFeeRecipient) external onlyOperatorOrMethodologist {
        address nonCaller = _getNonCaller();

        bytes32 expectedHash = keccak256(abi.encodePacked(_newFeeRecipient, nonCaller));

        if (expectedHash == proposedFeeRecipientHash) {
            feeModule.updateFeeRecipient(setToken, _newFeeRecipient);
            proposedFeeRecipientHash = bytes32(0);
        } else {
            proposedFeeRecipientHash = keccak256(abi.encodePacked(_newFeeRecipient, msg.sender));
        }
    }

    /**
     * OPERATOR OR METHODOLOGIST ONLY: Update the fee split percentage. Operator and Methodologist must each call
     * this function to execute the update.
     *
     * @param _newFeeSplit           New fee split percentage
     */
    function updateFeeSplit(uint256 _newFeeSplit) external onlyOperatorOrMethodologist {    
        require(
            _newFeeSplit <= PreciseUnitMath.preciseUnit(),
            "Operator Fee Split must be less than 1e18"
        );

        address nonCaller = _getNonCaller();

        bytes32 expectedHash = keccak256(abi.encodePacked(_newFeeSplit, nonCaller));

        if (expectedHash == proposedFeeSplitHash) {
            // Accrue fee to operator and methodologist prior to new fee split
            accrueFee();
            operatorFeeSplit = _newFeeSplit;
            proposedFeeSplitHash = bytes32(0);
        } else {
            proposedFeeSplitHash = keccak256(abi.encodePacked(_newFeeSplit, msg.sender));
        }
    }

    /**
     * OPERATOR ONLY: Update the index module
     *
     * @param _newIndexModule           New index module
     */
    function updateIndexModule(IIndexModule _newIndexModule) external onlyOperator {
        indexModule = _newIndexModule;
    }

    /**
     * METHODOLOGIST ONLY: Update the methodologist address
     *
     * @param _newMethodologist           New methodologist address
     */
    function updateMethodologist(address _newMethodologist) external onlyMethodologist {
        methodologist = _newMethodologist;
    }

    /**
     * OPERATOR ONLY: Update the operator address
     *
     * @param _newOperator           New operator address
     */
    function updateOperator(address _newOperator) external onlyOperator {
        operator = _newOperator;
    }

    /**
     * OPERATOR OR METHODOLOGIST ONLY: Update the timelock period for updating the streaming fee percentage.
     * Operator and Methodologist must each call this function to execute the update.
     *
     * @param _newTimeLockPeriod           New timelock period in seconds
     */
    function setTimeLockPeriod(uint256 _newTimeLockPeriod) external override onlyOperatorOrMethodologist {
        address nonCaller = _getNonCaller();

        bytes32 expectedHash = keccak256(abi.encodePacked(_newTimeLockPeriod, nonCaller));

        if (expectedHash == proposedTimeLockPeriodHash) {
            timeLockPeriod = _newTimeLockPeriod;
            proposedTimeLockPeriodHash = bytes32(0);
        } else {
            proposedTimeLockPeriodHash = keccak256(abi.encodePacked(_newTimeLockPeriod, msg.sender));
        }
    }

    /* ============ Internal Functions ============ */

    function _getNonCaller() internal view returns(address) {
        return msg.sender == operator ? methodologist : operator;
    }
}